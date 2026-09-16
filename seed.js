// No imports needed

const GAS_URL = "https://script.google.com/macros/s/AKfycbzEQtlE3AsXLYfuK9DCUrhSmE8XqlhnPAxohzzB5vwhx1ufmaWboLnmjDW96hOH2eva/exec";

async function runFetch(action, payload) {
  const response = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action, payload }),
  });
  return response.json();
}

async function seed() {
  console.log("Creando usuario de prueba...");
  const res = await runFetch("register_user", {
    nombre: "Usuario Prueba",
    rut: "12.345.678-9",
    correo: "test@hsu.com",
    clave: "123456",
    instagram: "test_ig",
    chatLink: "https://ig.me/m/test_ig",
    rol: "promotor"
  });
  console.log("Respuesta:", res);
}

seed();
