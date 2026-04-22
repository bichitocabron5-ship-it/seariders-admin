export type ReservationWorkflowState =
  | "draft"
  | "missing_customer_data"
  | "contract_pending"
  | "signed_pending_formalization"
  | "formalized"
  | "ready_for_platform"
  | "in_sea"
  | "completed"
  | "canceled";

export type ReservationWorkflowActionKind =
  | "submit"
  | "contracts"
  | "payments"
  | "none";

export type ReservationWorkflowResult = {
  visibleState: ReservationWorkflowState;
  label: string;
  description: string;
  primaryAction: {
    kind: ReservationWorkflowActionKind;
    label: string;
    targetId?: "contracts" | "payments";
  };
  missingRequirements: string[];
};

type ReservationWorkflowArgs = {
  uiMode?: "CREATE" | "FORMALIZE" | "EDIT";
  reservationId?: string | null;
  status?: string | null;
  formalizedAt?: string | Date | null;
  customerName?: string | null;
  customerPhone?: string | null;
  isReadOnly?: boolean;
  isCanceled?: boolean;
  isCompleted?: boolean;
  requiredUnits?: number | null;
  readyCount?: number | null;
  signedCount?: number | null;
  pendingServiceCents?: number | null;
  pendingDepositCents?: number | null;
};

function hasText(value: string | null | undefined) {
  return String(value ?? "").trim().length > 0;
}

function hasFormalizedAt(value: string | Date | null | undefined) {
  return Boolean(value);
}

export function getReservationWorkflowState(
  args: ReservationWorkflowArgs
): ReservationWorkflowResult {
  const status = String(args.status ?? "").toUpperCase();
  const customerMissing: string[] = [];
  if (!hasText(args.customerName)) customerMissing.push("Falta nombre del cliente.");
  if (!hasText(args.customerPhone)) customerMissing.push("Falta teléfono del cliente.");

  const requiredUnits = Math.max(0, Number(args.requiredUnits ?? 0));
  const readyCount = Math.max(0, Number(args.readyCount ?? 0));
  const signedCount = Math.max(0, Number(args.signedCount ?? 0));
  const contractsPending = requiredUnits > 0 && readyCount < requiredUnits;
  const hasReadyContracts = requiredUnits > 0 && readyCount >= requiredUnits;
  const hasSignedContracts = signedCount > 0;
  const pendingServiceCents = Math.max(0, Number(args.pendingServiceCents ?? 0));
  const pendingDepositCents = Math.max(0, Number(args.pendingDepositCents ?? 0));
  const isFormalized = hasFormalizedAt(args.formalizedAt);
  const submitLabel =
    args.uiMode === "EDIT"
      ? "Guardar cambios"
      : args.uiMode === "FORMALIZE"
        ? "Formalizar reserva"
        : "Crear reserva";

  if (args.isCanceled || status === "CANCELED") {
    return {
      visibleState: "canceled",
      label: "Reserva cancelada",
      description: "La reserva está cerrada y no admite más acciones operativas desde esta ficha.",
      primaryAction: { kind: "none", label: "Sin acción" },
      missingRequirements: [],
    };
  }

  if (args.isCompleted || status === "COMPLETED") {
    return {
      visibleState: "completed",
      label: "Reserva completada",
      description: "La reserva ya pasó por operación y cierre.",
      primaryAction: { kind: "none", label: "Sin acción" },
      missingRequirements: [],
    };
  }

  if (args.isReadOnly) {
    return {
      visibleState: "draft",
      label: "Ficha en solo lectura",
      description: "Puedes revisar el contenido, pero no avanzar el workflow desde aquí.",
      primaryAction: { kind: "none", label: "Sin acción" },
      missingRequirements: [],
    };
  }

  if (status === "IN_SEA") {
    return {
      visibleState: "in_sea",
      label: "Reserva en mar",
      description: "La reserva ya está en ejecución operativa.",
      primaryAction: { kind: "none", label: "Sin acción" },
      missingRequirements: [],
    };
  }

  if (status === "READY_FOR_PLATFORM") {
    return {
      visibleState: "ready_for_platform",
      label: "Lista para platform",
      description: "La reserva ya está cobrada, formalizada y preparada para operación.",
      primaryAction: { kind: "none", label: "Sin acción" },
      missingRequirements: [],
    };
  }

  if (customerMissing.length > 0) {
    return {
      visibleState: "missing_customer_data",
      label: "Faltan datos mínimos",
      description: "Completa el titular mínimo antes de seguir avanzando la reserva.",
      primaryAction: { kind: "submit", label: submitLabel },
      missingRequirements: customerMissing,
    };
  }

  if (!isFormalized && contractsPending) {
    return {
      visibleState: "contract_pending",
      label: "Contratos pendientes",
      description: "La reserva ya tiene titular, pero aún faltan contratos por completar o firmar.",
      primaryAction: { kind: "contracts", label: "Completar contratos", targetId: "contracts" },
      missingRequirements: [
        `Faltan contratos listos: ${readyCount}/${requiredUnits}.`,
      ],
    };
  }

  if (!isFormalized && (hasReadyContracts || hasSignedContracts)) {
    return {
      visibleState: "signed_pending_formalization",
      label: "Lista para formalizar",
      description: "Los contratos ya están preparados. El siguiente paso es formalizar la reserva.",
      primaryAction: { kind: "submit", label: "Formalizar reserva" },
      missingRequirements: [],
    };
  }

  if (isFormalized) {
    const pendingRequirements: string[] = [];
    if (pendingServiceCents > 0) {
      pendingRequirements.push("Queda servicio pendiente de cobro.");
    }
    if (pendingDepositCents > 0) {
      pendingRequirements.push("Queda fianza pendiente.");
    }

    return {
      visibleState: "formalized",
      label: pendingRequirements.length > 0 ? "Formalizada pendiente de cobro" : "Formalizada",
      description:
        pendingRequirements.length > 0
          ? "La reserva ya está formalizada, pero todavía falta completar cobro o revisión operativa."
          : "La reserva ya está formalizada y solo queda continuar con la operativa normal.",
      primaryAction:
        pendingServiceCents > 0 && args.reservationId
          ? { kind: "payments", label: "Registrar cobro", targetId: "payments" }
          : { kind: "none", label: "Sin acción" },
      missingRequirements: pendingRequirements,
    };
  }

  return {
    visibleState: args.reservationId ? "draft" : "draft",
    label: args.reservationId ? "Reserva pendiente de revisión" : "Borrador de reserva",
    description: args.reservationId
      ? "Guarda los cambios para mantener la ficha actualizada y continuar con el siguiente paso."
      : "Completa los datos básicos y crea la reserva para continuar después con contratos o cobro.",
    primaryAction: { kind: "submit", label: submitLabel },
    missingRequirements: [],
  };
}
