const DocumentPicker = {
  types: {
    pdf: "application/pdf"
  },
  async pickSingle(): Promise<never> {
    throw new Error("PDF seçimi web önizlemede desteklenmiyor.");
  },
  isCancel(error: unknown) {
    return Boolean(error && typeof error === "object" && "code" in error && error.code === "DOCUMENT_PICKER_CANCELED");
  }
};

export default DocumentPicker;
