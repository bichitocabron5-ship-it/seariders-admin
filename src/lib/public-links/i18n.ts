export type PublicLanguage = "es" | "en" | "fr";

export const PUBLIC_LANGUAGE_OPTIONS: Array<{ value: PublicLanguage; label: string }> = [
  { value: "es", label: "ES" },
  { value: "en", label: "EN" },
];

export function normalizePublicLanguage(value: string | null | undefined): PublicLanguage {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "en") return "en";
  if (normalized === "fr") return "fr";
  return "es";
}

export function getDefaultPublicLanguage(country?: string | null): PublicLanguage {
  const normalized = String(country ?? "").trim().toUpperCase();
  if (normalized === "FR") return "fr";
  if (normalized && normalized !== "ES") return "en";
  return "es";
}

export function appendPublicLanguage(url: string, language: PublicLanguage) {
  const isAbsolute = /^https?:\/\//i.test(url);
  const next = new URL(url, isAbsolute ? undefined : "http://localhost");
  next.searchParams.set("lang", language);
  return isAbsolute ? next.toString() : `${next.pathname}${next.search}`;
}

function localeForLanguage(language: PublicLanguage) {
  if (language === "en") return "en-GB";
  if (language === "fr") return "fr-FR";
  return "es-ES";
}

export function formatPublicDate(value: string | null, language: PublicLanguage) {
  if (!value) return language === "en" ? "No date" : language === "fr" ? "Sans date" : "Sin fecha";
  return new Date(value).toLocaleDateString(localeForLanguage(language));
}

export function formatPublicTime(value: string | null, language: PublicLanguage) {
  if (!value) return language === "en" ? "No time" : language === "fr" ? "Sans heure" : "Sin hora";
  return new Date(value).toLocaleTimeString(localeForLanguage(language), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type PublicCopy = {
  common: {
    requiredFields: string;
    documentTypeLabel: string;
    documentNumberLabel: string;
    marketingLabel: string;
    documentTypeOptions: Array<{ value: string; label: string }>;
    marketingOptions: Array<{ value: string; label: string }>;
  };
  signerModal: {
    titleEyebrow: string;
    title: string;
    expires: (value: string) => string;
    linkLabel: string;
    whatsappLabel: string;
    whatsappReady: (phone: string) => string;
    whatsappMissing: string;
    copyLink: string;
    copyMessage: string;
    sendWhatsapp: string;
    openLink: string;
    close: string;
    buildMessage: (args: { recipientName: string; unitLabel: string; url: string; expiryLabel: string }) => string;
  };
  precheckinModal: {
    titleEyebrow: string;
    title: string;
    description: (contractsCount: number) => string;
    linkLabel: string;
    whatsappLabel: string;
    whatsappReady: (phone: string) => string;
    whatsappMissing: string;
    copyLink: string;
    copyMessage: string;
    sendWhatsapp: string;
    openLink: string;
    close: string;
    buildMessage: (args: { recipientName: string; contractsCount: number; url: string; expiryLabel: string }) => string;
  };
  signPage: {
    eyebrow: string;
    title: (unitIndex: number) => string;
    done: string;
    intro: string;
    download: string;
    pdfHint: string;
    readConfirm: string;
    imageConsent: string;
    signerName: string;
    clear: string;
    sign: string;
    signed: string;
    saving: string;
    errors: {
      mustRead: string;
      signerRequired: string;
      signatureEmpty: string;
      saveFailed: string;
    };
  };
  checkinPage: {
    loading: string;
    loadFailed: string;
    eyebrow: string;
    title: string;
    autosaveIdle: string;
    autosaveSaving: string;
    autosaveSaved: string;
    autosaveError: string;
    metrics: {
      contracts: string;
      signed: string;
      ready: string;
      prepared: string;
      holder: string;
      pending: string;
    };
    intro: string;
    holderTitle: string;
    holderHelp: string;
    bookingSummary: string;
    holderName: string;
    holderPhone: string;
    holderEmail: string;
    save: string;
    saving: string;
    saved: string;
    unitTitle: (index: number) => string;
    pendingDriver: string;
    signedOn: (date: string) => string;
    useHolder: string;
    contractHelp: string;
    printable: string;
    scheduledTime: string;
    duration: string;
    assignedResource: string;
    accordingToReservation: string;
    driverName: string;
    driverPhone: string;
    driverEmail: string;
    driverCountry: string;
    driverAddress: string;
    driverPostalCode: string;
    driverBirthDate: string;
    licenseSchool: string;
    licenseType: string;
    licenseNumber: string;
    imageConsent: string;
    tutorAuthorization: (fileName: string | null) => string;
    signatureTitle: string;
    signatureHelp: string;
    clearSignature: string;
    signContract: string;
    signing: string;
    signedBanner: (name: string, date: string) => string;
  };
};

export function getPublicCopy(language: PublicLanguage): PublicCopy {
  const documentTypeOptions = [
    { value: "", label: language === "en" ? "Select..." : "Selecciona..." },
    { value: "DNI", label: "DNI" },
    { value: "NIE", label: "NIE" },
    { value: "PASSPORT", label: language === "en" ? "Passport" : "Pasaporte" },
  ];

  const marketingOptions = [
    { value: "", label: language === "en" ? "Select..." : "Selecciona..." },
    { value: "Instagram", label: "Instagram" },
    { value: "Facebook", label: "Facebook" },
    { value: "Recomendación", label: language === "en" ? "Recommendation" : "Recomendacion" },
    { value: "Google", label: "Google" },
    { value: "Radio", label: "Radio" },
    { value: "TikTok", label: "TikTok" },
    { value: "YouTube", label: "YouTube" },
    { value: "Flyers", label: "Flyers" },
    { value: "Otros", label: language === "en" ? "Other" : "Otros" },
    { value: "Hoteles", label: language === "en" ? "Hotel / accommodation" : "Hotel / alojamiento" },
  ];

  if (language === "en") {
    return {
      common: {
        requiredFields: "Fields marked with * are required.",
        documentTypeLabel: "Document type",
        documentNumberLabel: "Document number",
        marketingLabel: "How did you hear about us?",
        documentTypeOptions,
        marketingOptions,
      },
      signerModal: {
        titleEyebrow: "Tablet signature",
        title: "Scan this QR code from your phone or tablet",
        expires: (value) => `This signature link expires in ${value}.`,
        linkLabel: "Signature link",
        whatsappLabel: "WhatsApp message",
        whatsappReady: (phone) => `WhatsApp ready for ${phone || "the customer"}.`,
        whatsappMissing: "No valid phone number available for automatic WhatsApp opening. You can copy the message and send it manually.",
        copyLink: "Copy link",
        copyMessage: "Copy message",
        sendWhatsapp: "Send WhatsApp",
        openLink: "Open signature",
        close: "Close",
        buildMessage: ({ recipientName, unitLabel, url, expiryLabel }) =>
          `Hello ${recipientName || "customer"},\n\n` +
          `Here is your secure Seariders link to review and sign your booking contract (${unitLabel}).\n\n` +
          `${url}\n\n` +
          `Once the signature is completed, we will be able to continue with the booking formalization and payment.\n\n` +
          `This link expires in ${expiryLabel}.\n\n` +
          `Thank you.`,
      },
      precheckinModal: {
        titleEyebrow: "Remote pre-check-in",
        title: "Send single booking link",
        description: (contractsCount) =>
          `The customer will be able to complete their details, review ${contractsCount === 1 ? "the contract" : `the ${contractsCount} contracts`} and sign before arrival.`,
        linkLabel: "Pre-check-in link",
        whatsappLabel: "WhatsApp message",
        whatsappReady: (phone) => `WhatsApp ready for ${phone || "the customer"}.`,
        whatsappMissing: "No valid phone number available for automatic WhatsApp opening. You can copy the message and send it manually.",
        copyLink: "Copy link",
        copyMessage: "Copy message",
        sendWhatsapp: "Send WhatsApp",
        openLink: "Open link",
        close: "Close",
        buildMessage: ({ recipientName, contractsCount, url, expiryLabel }) =>
          `Hello ${recipientName || "customer"},\n\n` +
          `Here is your secure pre-check-in link to complete the contract details, review ${contractsCount === 1 ? "the contract" : "each contract"} and sign digitally before arrival.\n\n` +
          `${url}\n\n` +
          `Once completed, we will only need to review the final details on site before payment.\n\n` +
          `This link expires in ${expiryLabel}.\n\n` +
          `Thank you,\nSeariders team`,
      },
      signPage: {
        eyebrow: "Digital signature",
        title: (unitIndex) => `Contract unit #${unitIndex}`,
        done: "Contract signed successfully. You can download the PDF copy or return to the point of sale.",
        intro: "Review the full contract before signing. Once you have read it, confirm and sign at the end.",
        download: "Download PDF / printable view",
        pdfHint: "If the PDF is not available on this device, a printable contract view will open instead.",
        readConfirm: "I have read the full contract and I agree to sign it electronically.",
        imageConsent: "I agree to the use of my image for promotional and advertising purposes.",
        signerName: "Signer name",
        clear: "Clear",
        sign: "Sign contract",
        signed: "Signed",
        saving: "Saving...",
        errors: {
          mustRead: "You must read and accept the contract before signing.",
          signerRequired: "Signer name is required.",
          signatureEmpty: "The signature is empty.",
          saveFailed: "The signature could not be saved.",
        },
      },
      checkinPage: {
        loading: "Loading pre-check-in...",
        loadFailed: "The link could not be loaded.",
        eyebrow: "Digital pre-check-in",
        title: "Complete your details and sign your booking",
        autosaveIdle: "Changes will be saved automatically.",
        autosaveSaving: "Autosaving changes...",
        autosaveSaved: "Changes saved automatically.",
        autosaveError: "Autosave failed. Please check your connection.",
        metrics: {
          contracts: "Contracts",
          signed: "Signed",
          ready: "Ready",
          prepared: "Prepared for store",
          holder: "Holder",
          pending: "Pending",
        },
        intro: "Review each contract, complete the required details and sign at the end of each section. Fields marked with * are required. If the booking includes a minor with authorization, the documents will be validated on site before final payment.",
        holderTitle: "Booking holder details",
        holderHelp: "The booking data is already registered. Here we only ask one short commercial question before you complete the legal details for each contract.",
        bookingSummary: "Booking data already registered",
        holderName: "Full name *",
        holderPhone: "Phone *",
        holderEmail: "Email",
        save: "Save details",
        saving: "Saving...",
        saved: "Details saved successfully.",
        unitTitle: (index) => `Unit #${index}`,
        pendingDriver: "Driver pending",
        signedOn: (date) => `signed on ${date}`,
        useHolder: "Use booking holder details",
        contractHelp: "Complete only the legal details of the person who will sign and use this contract.",
        printable: "PDF / printable view",
        scheduledTime: "Scheduled time",
        duration: "Duration",
        assignedResource: "Assigned resource",
        accordingToReservation: "According to booking",
        driverName: "Driver name *",
        driverPhone: "Phone *",
        driverEmail: "Email",
        driverCountry: "Country *",
        driverAddress: "Address *",
        driverPostalCode: "Postal code",
        driverBirthDate: "Date of birth *",
        licenseSchool: "License school / issuer *",
        licenseType: "License type *",
        licenseNumber: "License number *",
        imageConsent: "I accept the image consent and the processing required for the activity.",
        tutorAuthorization: (fileName) =>
          `I confirm that parent or guardian authorization exists. ${fileName ? `Validated document: ${fileName}.` : "The copy will be validated in store."}`,
        signatureTitle: "Electronic signature",
        signatureHelp: "Before signing, save the details if you have made changes. Signing is only enabled when the contract includes all required information.",
        clearSignature: "Clear signature",
        signContract: "Sign contract",
        signing: "Signing...",
        signedBanner: (name, date) => `Contract signed by ${name || "the customer"} on ${date}.`,
      },
    };
  }

  return {
    common: {
      requiredFields: "Los campos marcados con * son obligatorios.",
      documentTypeLabel: "Tipo de documento",
      documentNumberLabel: "Numero de documento",
      marketingLabel: "Como nos conocio?",
      documentTypeOptions,
      marketingOptions,
    },
    signerModal: {
      titleEyebrow: "Firma en tablet",
      title: "Escanea este QR desde el movil o tablet",
      expires: (value) => `El enlace de firma caduca en ${value}.`,
      linkLabel: "Enlace de firma",
      whatsappLabel: "Mensaje para WhatsApp",
      whatsappReady: (phone) => `WhatsApp listo para ${phone || "el cliente"}.`,
      whatsappMissing: "No hay un telefono valido para abrir WhatsApp automaticamente. Puedes copiar el mensaje y enviarlo manualmente.",
      copyLink: "Copiar enlace",
      copyMessage: "Copiar mensaje",
      sendWhatsapp: "Enviar WhatsApp",
      openLink: "Abrir firma",
      close: "Cerrar",
      buildMessage: ({ recipientName, unitLabel, url, expiryLabel }) =>
        `Hola ${recipientName || "cliente"},\n\n` +
        `Le enviamos el enlace seguro para revisar y firmar su contrato de reserva con Seariders (${unitLabel}).\n\n` +
        `${url}\n\n` +
        `Cuando la firma quede registrada, podremos continuar con la formalizacion y el cobro de su reserva.\n\n` +
        `Este enlace caduca en ${expiryLabel}.\n\n` +
        `Gracias.`,
    },
    precheckinModal: {
      titleEyebrow: "Pre-checkin remoto",
      title: "Enviar enlace unico de reserva",
      description: (contractsCount) =>
        `El cliente podra completar sus datos, revisar ${contractsCount === 1 ? "el contrato" : `los ${contractsCount} contratos`} y firmar antes de venir.`,
      linkLabel: "Enlace de pre-checkin",
      whatsappLabel: "Mensaje para WhatsApp",
      whatsappReady: (phone) => `WhatsApp listo para ${phone || "el cliente"}.`,
      whatsappMissing: "No hay un telefono valido para abrir WhatsApp automaticamente. Puedes copiar el mensaje y enviarlo manualmente.",
      copyLink: "Copiar enlace",
      copyMessage: "Copiar mensaje",
      sendWhatsapp: "Enviar WhatsApp",
      openLink: "Abrir enlace",
      close: "Cerrar",
      buildMessage: ({ recipientName, contractsCount, url, expiryLabel }) =>
        `Hola ${recipientName || "cliente"},\n\n` +
        `Le enviamos su enlace seguro de pre-checkin para completar los datos del contrato, revisar el contrato${contractsCount === 1 ? "" : " de cada unidad"} y firmarlo digitalmente antes de su llegada.\n\n` +
        `${url}\n\n` +
        `Una vez completado, en tienda solo revisaremos los datos finales para continuar con el cobro.\n\n` +
        `Este enlace caduca en ${expiryLabel}.\n\n` +
        `Gracias,\nEquipo Seariders`,
    },
    signPage: {
      eyebrow: "Firma digital",
      title: (unitIndex) => `Contrato unidad #${unitIndex}`,
      done: "Contrato firmado correctamente. Puedes descargar la copia en PDF o volver al punto de venta.",
      intro: "Revisa el contrato completo antes de firmar. Cuando lo hayas leido, confirma la lectura y firma al final.",
      download: "Descargar PDF / vista imprimible",
      pdfHint: "Si el PDF no esta disponible en este dispositivo, se abrira una version imprimible del contrato.",
      readConfirm: "He leido el contrato completo y acepto firmarlo electronicamente.",
      imageConsent: "Acepto el uso de mi imagen con fines promocionales y publicitarios.",
      signerName: "Nombre del firmante",
      clear: "Limpiar",
      sign: "Firmar contrato",
      signed: "Firmado",
      saving: "Guardando...",
      errors: {
        mustRead: "Debes leer y aceptar el contrato antes de firmar",
        signerRequired: "Nombre del firmante requerido",
        signatureEmpty: "La firma esta vacia",
        saveFailed: "No se pudo guardar la firma",
      },
    },
    checkinPage: {
      loading: "Cargando pre-checkin...",
      loadFailed: "No se pudo cargar el enlace.",
      eyebrow: "Pre-checkin digital",
      title: "Complete sus datos y firme su reserva",
      autosaveIdle: "Los cambios se guardaran automaticamente.",
      autosaveSaving: "Guardado automatico en curso...",
      autosaveSaved: "Cambios guardados automaticamente.",
      autosaveError: "No se pudo guardar automaticamente. Revisa la conexion.",
      metrics: {
        contracts: "Contratos",
        signed: "Firmados",
        ready: "Listos",
        prepared: "Preparados para tienda",
        holder: "Titular",
        pending: "Pendiente",
      },
      intro: "Revise el contrato de cada unidad, complete los datos obligatorios y firme al final de cada bloque. Los campos marcados con * son obligatorios. Si la reserva incluye un menor con autorizacion, la documentacion debera validarse en tienda antes del cobro definitivo.",
      holderTitle: "Datos del titular",
      holderHelp: "Los datos de la reserva ya estan registrados. Aqui solo le pedimos una breve pregunta comercial antes de completar los datos legales de cada contrato.",
      bookingSummary: "Datos de reserva ya registrados",
      holderName: "Nombre y apellidos *",
      holderPhone: "Telefono *",
      holderEmail: "Email",
      save: "Guardar datos",
      saving: "Guardando...",
      saved: "Datos guardados correctamente.",
      unitTitle: (index) => `Unidad #${index}`,
      pendingDriver: "Conductor pendiente",
      signedOn: (date) => `firmado el ${date}`,
      useHolder: "Usar datos del titular de la reserva",
      contractHelp: "Complete solo los datos legales de la persona que va a firmar y realizar esta unidad.",
      printable: "PDF / vista imprimible",
      scheduledTime: "Hora programada",
      duration: "Duracion",
      assignedResource: "Recurso asignado",
      accordingToReservation: "Segun reserva",
      driverName: "Nombre del conductor *",
      driverPhone: "Telefono *",
      driverEmail: "Email",
      driverCountry: "Pais *",
      driverAddress: "Direccion *",
      driverPostalCode: "Codigo postal",
      driverBirthDate: "Fecha de nacimiento *",
      licenseSchool: "Escuela / emisor *",
      licenseType: "Tipo de licencia *",
      licenseNumber: "Numero de licencia *",
      imageConsent: "Acepto el consentimiento de imagen y el tratamiento necesario para la actividad.",
      tutorAuthorization: (fileName) =>
        `Confirmo que existe autorizacion del padre, madre o tutor. ${fileName ? `Documento validado: ${fileName}.` : "La copia se validara en tienda."}`,
      signatureTitle: "Firma electronica",
      signatureHelp: "Antes de firmar, guarde los datos si ha realizado cambios. La firma solo se habilita cuando el contrato tiene toda la informacion obligatoria.",
      clearSignature: "Limpiar firma",
      signContract: "Firmar contrato",
      signing: "Firmando...",
      signedBanner: (name, date) => `Contrato firmado por ${name || "el cliente"} el ${date}.`,
    },
  };
}
