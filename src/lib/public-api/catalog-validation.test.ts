import assert from "node:assert/strict";
import test from "node:test";

import { findPublicWebCatalogOptionOrThrow } from "./catalog";
import { PublicApiError } from "./errors";

type Reader = Parameters<typeof findPublicWebCatalogOptionOrThrow>[0];

type QueryWithWhere = {
  where?: Record<string, unknown>;
};

function makeReader(config: {
  channel?: { id: string; code: string | null; isActive: boolean; visibleInWeb: boolean; allowsPromotions: boolean } | null;
  option?: {
    id: string;
    code: string | null;
    durationMinutes: number | null;
    paxMax: number | null;
    service: {
      id: string;
      code: string | null;
      name: string;
      category: string | null;
      isLicense: boolean;
    };
  } | null;
  rules?: Array<{ serviceId: string; channelId: string; active: boolean }>;
}) {
  const channelQueries: unknown[] = [];
  const optionQueries: unknown[] = [];
  const ruleQueries: unknown[] = [];
  const reader = {
    channel: {
      findUnique: async (query: unknown) => {
        channelQueries.push(query);
        return config.channel ?? {
          id: "channel-web",
          code: "WEB",
          isActive: true,
          visibleInWeb: true,
          allowsPromotions: false,
        };
      },
    },
    serviceOption: {
      findFirst: async (query: unknown) => {
        optionQueries.push(query);
        return config.option ?? null;
      },
    },
    serviceAllowedChannel: {
      findMany: async (query: unknown) => {
        ruleQueries.push(query);
        return config.rules ?? [];
      },
    },
  };

  return {
    reader: reader as unknown as Reader,
    channelQueries,
    optionQueries,
    ruleQueries,
  };
}

function whereOf(query: unknown) {
  return (query as QueryWithWhere).where ?? {};
}

test("WEB catalog validation resolves channel by code WEB", async () => {
  const fixture = makeReader({
    option: {
      id: "option-web",
      code: "JETSKI_30_2",
      durationMinutes: 30,
      paxMax: 2,
      service: {
        id: "service-jetski",
        code: "JETSKI",
        name: "Jetski",
        category: "JETSKI",
        isLicense: false,
      },
    },
  });

  await findPublicWebCatalogOptionOrThrow(fixture.reader, {
    serviceCode: "JETSKI",
    optionCode: "JETSKI_30_2",
  });

  assert.deepEqual(whereOf(fixture.channelQueries[0]), { code: "WEB" });
});

test("WEB catalog validation requires service and option visibleInWeb", async () => {
  const fixture = makeReader({ option: null });

  await assert.rejects(
    findPublicWebCatalogOptionOrThrow(fixture.reader, {
      serviceCode: "JETSKI",
      optionCode: "JETSKI_30_2",
    }),
    (error) =>
      error instanceof PublicApiError &&
      error.code === "INVALID_INPUT" &&
      error.status === 400
  );

  const optionWhere = whereOf(fixture.optionQueries[0]);
  assert.equal(optionWhere.visibleInWeb, true);
  assert.deepEqual(optionWhere.service, {
    code: "JETSKI",
    isActive: true,
    visibleInWeb: true,
  });
});

test("WEB catalog validation rejects services not allowed for WEB channel", async () => {
  const fixture = makeReader({
    option: {
      id: "option-web",
      code: "JETSKI_30_2",
      durationMinutes: 30,
      paxMax: 2,
      service: {
        id: "service-jetski",
        code: "JETSKI",
        name: "Jetski",
        category: "JETSKI",
        isLicense: false,
      },
    },
    rules: [{ serviceId: "service-jetski", channelId: "channel-store", active: true }],
  });

  await assert.rejects(
    findPublicWebCatalogOptionOrThrow(fixture.reader, {
      serviceCode: "JETSKI",
      optionCode: "JETSKI_30_2",
    }),
    (error) =>
      error instanceof PublicApiError &&
      error.code === "INVALID_INPUT" &&
      error.status === 400
  );
});
