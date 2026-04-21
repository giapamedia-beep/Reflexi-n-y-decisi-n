import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type AnalysisType = 'pros_cons' | 'swot' | 'matrix' | 'hats' | 'regret' | 'decision_tree' | 'delphi';

export async function analyzeDecision(description: string, type: AnalysisType) {
  const model = "gemini-3-flash-preview";

  let responseSchema;
  let systemInstruction = "Eres un experto analista de decisiones. Analiza la situación planteada y ofrece una respuesta estructurada según el marco solicitado en español.";

  switch (type) {
    case 'pros_cons':
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          pros: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de puntos positivos" },
          cons: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de puntos negativos" },
          conclusion: { type: Type.STRING, description: "Un breve resumen de la balanza" }
        },
        required: ["pros", "cons", "conclusion"]
      };
      break;
    case 'swot':
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
          opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
          threats: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["strengths", "weaknesses", "opportunities", "threats"]
      };
      break;
    case 'matrix':
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          criteria: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT, 
              properties: {
                name: { type: Type.STRING },
                weight: { type: Type.NUMBER, description: "Del 1 al 10" }
              }
            } 
          },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                scores: { 
                  type: Type.ARRAY, 
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      criterion: { type: Type.STRING },
                      score: { type: Type.NUMBER }
                    },
                    required: ["criterion", "score"]
                  }
                }
              },
              required: ["name", "scores"]
            }
          }
        },
        required: ["criteria", "options"]
      };
      break;
    case 'hats':
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          blue: { type: Type.STRING, description: "Control y proceso" },
          white: { type: Type.STRING, description: "Hechos y datos" },
          red: { type: Type.STRING, description: "Sentimientos e intuición" },
          black: { type: Type.STRING, description: "Puntos negativos y riesgos" },
          yellow: { type: Type.STRING, description: "Beneficios y optimismo" },
          green: { type: Type.STRING, description: "Creatividad y alternativas" }
        },
        required: ["blue", "white", "red", "black", "yellow", "green"]
      };
      break;
    case 'regret':
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          short_term: { type: Type.STRING, description: "Impacto en 10 minutos" },
          medium_term: { type: Type.STRING, description: "Impacto en 10 meses" },
          long_term: { type: Type.STRING, description: "Impacto en 10 años (Minimización del arrepentimiento)" }
        },
        required: ["short_term", "medium_term", "long_term"]
      };
      break;
    case 'decision_tree':
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          initial_choice: { type: Type.STRING },
          branches: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                action: { type: Type.STRING },
                outcome: { type: Type.STRING },
                probability: { type: Type.STRING, description: "Probabilidad estimada (ej: Alta, 70%, Baja)" },
                risk: { type: Type.STRING }
              }
            }
          }
        },
        required: ["initial_choice", "branches"]
      };
      break;
    case 'delphi':
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          expert_panel: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                role: { type: Type.STRING, description: "Perfil del experto simualdo (ej: Economista, Psicólogo)" },
                opinion: { type: Type.STRING },
                score: { type: Type.NUMBER, description: "Grado de acuerdo con la decisión de 1 a 10" }
              }
            }
          },
          consensus_summary: { type: Type.STRING, description: "Síntesis del debate de expertos" }
        },
        required: ["expert_panel", "consensus_summary"]
      };
      break;
  }

  const response = await ai.models.generateContent({
    model,
    contents: `Situación: ${description}`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: responseSchema as any
    }
  });

  const result = JSON.parse(response.text || '{}');

  // Transform matrix scores back into a map for the frontend if needed
  if (type === 'matrix' && result.options) {
    result.options = result.options.map((opt: any) => ({
      ...opt,
      scores: opt.scores.reduce((acc: any, s: any) => ({ ...acc, [s.criterion]: s.score }), {})
    }));
  }

  return result;
}
