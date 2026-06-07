// Zone definitions for TCA Sidestick X Airbus — 1000x1000 viewBox
// FORGE_BTN: Forge firmware button index (null = no GPIO in Forge firmware)

export const VIEWBOX = { width: 1000, height: 1000 }

export const BUTTONS = [
  // --- Handle (top) ---
  { id: 'hat_up',          label: 'Hat ↑',                  group: 'handle', glow: '#7fd4ff', forgeBtnIdx: 6 ,
    shape: { type: 'poly', points: [[488, 110], [510, 138], [466, 138]] } },
  { id: 'hat_down',        label: 'Hat ↓',                  group: 'handle', glow: '#7fd4ff', forgeBtnIdx: 7,
    shape: { type: 'poly', points: [[488, 172], [510, 144], [466, 144]] } },
  { id: 'hat_left',        label: 'Hat ←',                  group: 'handle', glow: '#7fd4ff', forgeBtnIdx: 8,
    shape: { type: 'poly', points: [[457, 141], [483, 120], [483, 162]] } },
  { id: 'hat_right',       label: 'Hat →',                  group: 'handle', glow: '#7fd4ff', forgeBtnIdx: 9,
    shape: { type: 'poly', points: [[519, 141], [493, 120], [493, 162]] } },
  { id: 'btn_handle_left', label: 'Handle button (left)',   group: 'handle', glow: '#7fd4ff', forgeBtnIdx: 5,
    shape: { type: 'circle', cx: 407, cy: 154, r: 16 } },
  { id: 'btn_red',         label: 'Trigger (red)',          group: 'handle', glow: '#ff4d4d', forgeBtnIdx: 0,
    shape: { type: 'circle', cx: 596, cy: 166, r: 19 } },   /* même bit que L_X — les deux brillent */

  // --- Left cluster ---
  { id: 'L_X',   label: 'X (left) / Trigger', group: 'left', glow: '#ff4d4d', forgeBtnIdx: 0,
    shape: { type: 'poly', points: [[225, 587], [266, 587], [266, 625], [225, 625]] } },
  { id: 'L_Y',   label: 'Y (left)',       group: 'left', glow: '#ffd23f', forgeBtnIdx: 16,
    shape: { type: 'poly', points: [[270, 587], [311, 587], [311, 625], [270, 625]] } },
  { id: 'L_B1',  label: 'B1 (left)',      group: 'left', glow: '#7fd4ff', forgeBtnIdx: 17,
    shape: { type: 'poly', points: [[315, 587], [356, 587], [356, 625], [315, 625]] } },
  { id: 'L_A',   label: 'A (left)',       group: 'left', glow: '#5fe39a', forgeBtnIdx: 1,
    shape: { type: 'poly', points: [[212, 635], [252, 635], [252, 689], [212, 689]] } },
  { id: 'L_B',   label: 'B (left)',       group: 'left', glow: '#ff5c8a', forgeBtnIdx: 2,
    shape: { type: 'poly', points: [[256, 635], [294, 635], [294, 689], [256, 689]] } },
  { id: 'L_B2',  label: 'B2 (left)',      group: 'left', glow: '#7fd4ff', forgeBtnIdx: 18,
    shape: { type: 'poly', points: [[298, 635], [351, 635], [351, 689], [298, 689]] } },
  { id: 'L_icon', label: 'Eject L', group: 'left', glow: '#ffb347', forgeBtnIdx: 19,
    shape: { type: 'poly', points: [[291, 690], [346, 690], [346, 733], [291, 733]] } },

  // --- Right cluster (mirror) ---
  { id: 'R_B1',  label: 'B1 (right)',     group: 'right', glow: '#7fd4ff', forgeBtnIdx: 13,
    shape: { type: 'poly', points: [[637, 587], [677, 587], [677, 625], [637, 625]] } },
  { id: 'R_X',   label: 'X (right)',      group: 'right', glow: '#5fe39a', forgeBtnIdx: 12,
    shape: { type: 'poly', points: [[681, 587], [722, 587], [722, 625], [681, 625]] } },
  { id: 'R_Y',   label: 'Y (right)',      group: 'right', glow: '#ffd23f', forgeBtnIdx: 11,
    shape: { type: 'poly', points: [[726, 587], [773, 587], [773, 625], [726, 625]] } },
  { id: 'R_B2',  label: 'B2 (right)',     group: 'right', glow: '#7fd4ff', forgeBtnIdx: 14,
    shape: { type: 'poly', points: [[635, 635], [678, 635], [678, 689], [635, 689]] } },
  { id: 'R_A',   label: 'A (right)',      group: 'right', glow: '#5fe39a', forgeBtnIdx: 3,
    shape: { type: 'poly', points: [[682, 635], [728, 635], [728, 689], [682, 689]] } },
  { id: 'R_B',   label: 'B (right)',      group: 'right', glow: '#ff5c8a', forgeBtnIdx: 4,
    shape: { type: 'poly', points: [[732, 635], [781, 635], [781, 689], [732, 689]] } },
  { id: 'R_icon', label: 'Eject R', group: 'right', glow: '#ffb347', forgeBtnIdx: 20,
    shape: { type: 'poly', points: [[636, 690], [692, 690], [692, 733], [636, 733]] } },

  // --- Center ---
  { id: 'roller', label: 'Roller (center)', group: 'center', glow: '#ffb347', forgeBtnIdx: 10,
    shape: { type: 'poly', points: [[456, 726], [511, 726], [511, 806], [456, 806]] } },
]

export const BUTTONS_BY_ID = Object.fromEntries(BUTTONS.map(b => [b.id, b]))

// Reverse: Forge BTN index → zone id
export const BTN_TO_ZONE = Object.fromEntries(
  BUTTONS.filter(b => b.forgeBtnIdx !== null).map(b => [b.forgeBtnIdx, b.id])
)
