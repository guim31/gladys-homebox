// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`): find an item in Homebox, for a
// scene that checks a stock ("fewer than 4 AA batteries left?") or says where
// something is stored.
// -----------------------------------------------------------------------------

export const SCENE_ACTIONS = {
  find_item(hub, { fields = {} }) {
    return hub.findItem(fields.name);
  },
};
