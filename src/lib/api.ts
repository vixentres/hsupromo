export const GAS_URL = "LA_URL_DE_TU_SCRIPT_AQUI"; // El usuario pondrá su URL aquí

export async function fetchGAS(action: string, payload: any = {}) {
  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain", // Text plain para evitar preflight issues en GAS
      },
      body: JSON.stringify({ action, payload }),
    });
    return await response.json();
  } catch (error) {
    console.error("GAS Error:", error);
    return { status: "error", message: error instanceof Error ? error.message : "Error desconocido" };
  }
}
