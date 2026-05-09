type Asset = {
  uri?: string;
  base64?: string;
  type?: string;
  fileName?: string;
};

type Result = {
  didCancel?: boolean;
  errorMessage?: string;
  assets?: Asset[];
};

function pickFromInput(): Promise<Result> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve({ didCancel: true });
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    let settled = false;
    const settle = (r: Result) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        settle({ didCancel: true });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? "");
        const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
        settle({
          assets: [{ uri: dataUrl, base64, type: file.type, fileName: file.name }]
        });
      };
      reader.onerror = () => settle({ errorMessage: "Görsel okunamadı" });
      reader.readAsDataURL(file);
    });

    window.addEventListener(
      "focus",
      () => {
        setTimeout(() => {
          if (!input.files || input.files.length === 0) settle({ didCancel: true });
        }, 400);
      },
      { once: true }
    );

    input.click();
  });
}

export function launchImageLibrary(): Promise<Result> {
  return pickFromInput();
}

export function launchCamera(): Promise<Result> {
  return pickFromInput();
}

export default { launchImageLibrary, launchCamera };
