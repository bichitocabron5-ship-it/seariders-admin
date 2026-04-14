import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyContractSignatureToken } from "@/lib/contracts/signature-link";
import { SignContractPageClient } from "./sign-contract-page-client";

export const runtime = "nodejs";

export default async function SignContractPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = verifyContractSignatureToken(token);
  if (!payload) notFound();

  const contract = await prisma.reservationContract.findUnique({
    where: { id: payload.contractId },
    select: {
      id: true,
      unitIndex: true,
      logicalUnitIndex: true,
      status: true,
      driverName: true,
      signatureSignedBy: true,
      signedAt: true,
      reservation: {
        select: {
          id: true,
          customerName: true,
          service: { select: { name: true } },
          option: { select: { durationMinutes: true } },
          activityDate: true,
        },
      },
    },
  });

  if (!contract) notFound();

  return (
    <SignContractPageClient
      token={token}
      contract={{
        id: contract.id,
        unitIndex: Number(contract.logicalUnitIndex ?? contract.unitIndex),
        status: contract.status,
        driverName: contract.driverName ?? "",
        signatureSignedBy: contract.signatureSignedBy ?? "",
        signedAt: contract.signedAt ? contract.signedAt.toISOString() : null,
        reservationId: contract.reservation.id,
        customerName: contract.reservation.customerName ?? "",
        serviceName: contract.reservation.service?.name ?? "",
        durationMinutes: contract.reservation.option?.durationMinutes ?? null,
        activityDate: contract.reservation.activityDate.toISOString(),
      }}
    />
  );
}
