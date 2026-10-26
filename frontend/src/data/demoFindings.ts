
export type DemoFinding = {
  id: string;
  title: string;
  description: string;
  referencePage: number;
  finalPage: number;
};

export const DEMO_FINDINGS: DemoFinding[] = [
  {
    id: "price",
    title: "Diferencia de precio",
    description: "Ejemplo ficticio de una diferencia de importes.",
    referencePage: 1,
    finalPage: 1,
  },
  {
    id: "deadline",
    title: "Cambio en el plazo",
    description: "Ejemplo ficticio de un cambio en las condiciones.",
    referencePage: 2,
    finalPage: 3,
  },
  {
    id: "support",
    title: "Condicion de soporte",
    description: "Ejemplo ficticio de una clausula que requiere revision.",
    referencePage: 3,
    finalPage: 2,
  },
];
