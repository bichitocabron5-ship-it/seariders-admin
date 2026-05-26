import assert from "node:assert/strict";
import test from "node:test";

import {
  getDisplayChannels,
  reconcileChannelSelectionOnServiceChange,
  resolveCompatibleChannelFallback,
} from "./store-create-channel";

const channels = [
  { id: "direct" },
  { id: "agency" },
  { id: "hotel" },
];

test("mantiene el canal seleccionado cuando sigue siendo compatible", () => {
  const result = reconcileChannelSelectionOnServiceChange({
    previousServiceId: "svc-old",
    serviceId: "svc-new",
    channelId: "agency",
    compatibleChannels: [{ id: "agency" }, { id: "hotel" }],
  });

  assert.equal(result.nextChannelId, "agency");
  assert.equal(result.notice, null);
});

test("limpia el canal y muestra aviso cuando deja de ser compatible", () => {
  const result = reconcileChannelSelectionOnServiceChange({
    previousServiceId: "svc-old",
    serviceId: "svc-new",
    channelId: "agency",
    compatibleChannels: [{ id: "direct" }],
  });

  assert.equal(result.nextChannelId, "");
  assert.equal(result.notice, "El canal seleccionado no está disponible para este servicio.");
});

test("autoselecciona el primer canal compatible cuando no hay canal cargado", () => {
  assert.equal(
    resolveCompatibleChannelFallback({
      channelId: "",
      channelCompatibilityNotice: null,
      compatibleChannels: [{ id: "direct" }, { id: "hotel" }],
    }),
    "direct"
  );
});

test("displayChannels conserva el canal actual aunque ya no sea compatible para que no desaparezca del selector", () => {
  const displayChannels = getDisplayChannels({
    channelId: "agency",
    channelsWithFallback: channels,
    compatibleChannels: [{ id: "direct" }],
  });

  assert.deepEqual(
    displayChannels.map((channel) => channel.id),
    ["agency", "direct"]
  );
});
