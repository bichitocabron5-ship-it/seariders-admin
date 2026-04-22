type NullableText = string | null | undefined;

type ContractPartyLike = {
  driverName?: NullableText;
  driverPhone?: NullableText;
  driverEmail?: NullableText;
  driverCountry?: NullableText;
};

type ReservationHolderLike = {
  customerName?: NullableText;
  customerPhone?: NullableText;
  customerEmail?: NullableText;
  customerCountry?: NullableText;
};

function cleanText(value: NullableText) {
  const trimmed = String(value ?? "").trim();
  return trimmed.length ? trimmed : null;
}

export function summarizeReservationContracts(
  contracts: Array<{
    status?: string | null;
    driverName?: NullableText;
  }>
) {
  const normalizedNames = Array.from(
    new Set(
      contracts
        .map((contract) => cleanText(contract.driverName))
        .filter((name): name is string => Boolean(name))
    )
  );

  return {
    contractsCount: contracts.length,
    readyContractsCount: contracts.filter((contract) => String(contract.status) === "READY").length,
    signedContractsCount: contracts.filter((contract) => String(contract.status) === "SIGNED").length,
    primaryDriverName: normalizedNames[0] ?? null,
    driverNamesSummary: normalizedNames.join(", ") || null,
  };
}

export function resolveContractNotificationRecipient(args: {
  contract: ContractPartyLike;
  reservation: ReservationHolderLike;
}) {
  const contractName = cleanText(args.contract.driverName);
  const contractPhone = cleanText(args.contract.driverPhone);
  const contractCountry = cleanText(args.contract.driverCountry);

  const holderName = cleanText(args.reservation.customerName);
  const holderPhone = cleanText(args.reservation.customerPhone);
  const holderCountry = cleanText(args.reservation.customerCountry);

  return {
    recipientName: contractName ?? holderName ?? "cliente",
    phone: contractPhone ?? holderPhone,
    country: contractCountry ?? holderCountry ?? "ES",
    source: contractName || contractPhone || contractCountry ? "CONTRACT" : "RESERVATION",
  } as const;
}

export function contractLegalParty(args: {
  contract: ContractPartyLike;
}) {
  return {
    driverName: cleanText(args.contract.driverName),
    driverPhone: cleanText(args.contract.driverPhone),
    driverEmail: cleanText(args.contract.driverEmail),
    driverCountry: cleanText(args.contract.driverCountry),
  };
}

export function reservationHolderParty(args: {
  reservation: ReservationHolderLike;
}) {
  return {
    customerName: cleanText(args.reservation.customerName),
    customerPhone: cleanText(args.reservation.customerPhone),
    customerEmail: cleanText(args.reservation.customerEmail),
    customerCountry: cleanText(args.reservation.customerCountry),
  };
}
