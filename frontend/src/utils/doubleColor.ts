export type DoubleColor = "red" | "black" | "white";

export function getDoubleColor(number: number): DoubleColor {
  if (!Number.isFinite(number) || number < 0 || number > 14) {
    throw new Error("Numero invalido para Double. Esperado valor entre 0 e 14.");
  }

  if (number === 0) {
    return "white";
  }

  if (number >= 1 && number <= 7) {
    return "red";
  }

  return "black";
}
