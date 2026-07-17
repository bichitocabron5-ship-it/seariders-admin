import { templateCodeForContract } from "@/lib/contracts/render-contract";

type RenderContextReservation = {
  id: string;
  activityDate: Date | string | null;
  scheduledTime: Date | string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerCountry: string | null;
  quantity: number | null;
  pax: number | null;
  totalPriceCents: number | null;
  isLicense: boolean | null;
  option: { durationMinutes: number | null } | null;
  service: { name: string | null; category: string | null } | null;
};

type RenderContextReservationItem = {
  id: string;
  serviceId: string;
  optionId: string | null;
  quantity: number | null;
  pax: number | null;
  totalPriceCents: number | null;
  option: { durationMinutes: number | null } | null;
  service: { name: string | null; category: string | null } | null;
} | null;

export type ContractRenderContextSource = {
  id: string;
  templateCode: string | null;
  licenseNumber: string | null;
  reservation: RenderContextReservation;
  reservationItem?: RenderContextReservationItem;
};

function hasLicensedTemplate(templateCode: string | null | undefined) {
  return String(templateCode ?? "").trim().toUpperCase().endsWith("_LICENSED");
}

function resolveTemplateCode(contract: ContractRenderContextSource, category: string | null) {
  const storedTemplateCode = String(contract.templateCode ?? "").trim().toUpperCase();
  if (storedTemplateCode) return storedTemplateCode;

  const hasLicense =
    hasLicensedTemplate(contract.templateCode) ||
    Boolean(contract.licenseNumber?.trim()) ||
    Boolean(contract.reservation.isLicense);

  return templateCodeForContract({
    category,
    hasLicense,
  });
}

export function resolveContractRenderContext(contract: ContractRenderContextSource) {
  const item = contract.reservationItem ?? null;
  const service = item?.service ?? contract.reservation.service;
  const option = item?.option ?? contract.reservation.option;
  const templateCode = resolveTemplateCode(contract, service?.category ?? null);

  return {
    templateCode,
    reservation: {
      id: contract.reservation.id,
      activityDate: contract.reservation.activityDate,
      scheduledTime: contract.reservation.scheduledTime,
      customerName: contract.reservation.customerName,
      customerEmail: contract.reservation.customerEmail,
      customerPhone: contract.reservation.customerPhone,
      customerCountry: contract.reservation.customerCountry,
      serviceName: service?.name ?? null,
      serviceCategory: service?.category ?? null,
      quantity: item?.quantity ?? contract.reservation.quantity,
      pax: item?.pax ?? contract.reservation.pax,
      durationMinutes: option?.durationMinutes ?? null,
      totalPriceCents: item?.totalPriceCents ?? contract.reservation.totalPriceCents,
    },
  };
}
