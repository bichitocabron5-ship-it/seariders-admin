// src/app/store/create/services/contracts.ts
import type { ContractPatch, ReservationContractsResponse, PreparedResourcesResponse } from "../types";

export async function ensureContracts(reservationId: string) {
  const res = await fetch(`/api/store/reservations/${reservationId}/contracts/ensure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function fetchContracts(
  reservationId: string
): Promise<ReservationContractsResponse> {
  const res = await fetch(`/api/store/reservations/${reservationId}/contracts`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function patchContract(reservationId: string, contractId: string, input: ContractPatch) {
  const res = await fetch(`/api/store/reservations/${reservationId}/contracts/${contractId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function renderContract(contractId: string) {
  const res = await fetch(`/api/store/contracts/${contractId}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function signContract(contractId: string) {
  const res = await fetch(`/api/store/contracts/${contractId}/sign`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function generateContractPdf(contractId: string) {
  const res = await fetch(`/api/store/contracts/${contractId}/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function fetchPreparedOptions(): Promise<PreparedResourcesResponse> {
  const res = await fetch(`/api/store/contracts/prepared-options`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function getSignedContractDownloadUrl(contractId: string) {
  const res = await fetch(`/api/store/contracts/${contractId}/download`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function getSignedMinorAuthorizationDownloadUrl(contractId: string) {
  const res = await fetch(`/api/store/contracts/${contractId}/minor-authorization/download`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function saveContractSignature(args: {
  contractId: string;
  signerName: string;
  imageDataUrl: string;
}) {
  const res = await fetch(`/api/store/contracts/${args.contractId}/signature`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signerName: args.signerName,
      imageDataUrl: args.imageDataUrl,
    }),
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function getContractSignerLink(contractId: string): Promise<{ ok: true; url: string; expiresInMinutes: number }> {
  const res = await fetch(`/api/store/contracts/${contractId}/signer-link`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function uploadMinorAuthorization(args: {
  contractId: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append("file", args.file);

  const res = await fetch(`/api/store/contracts/${args.contractId}/minor-authorization`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function deleteMinorAuthorization(contractId: string) {
  const res = await fetch(`/api/store/contracts/${contractId}/minor-authorization`, {
    method: "DELETE",
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}
