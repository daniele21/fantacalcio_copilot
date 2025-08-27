import { RiskTag } from "./types";

export function riskPillClasses(risk: RiskTag) {
  switch (risk) {
      case "Safe":
        return "bg-base-100 text-content-100"; // Updated to use CDN classes
      case "Upside":
        return "bg-base-200 text-content-200"; // Updated to use CDN classes
    default:
        return "bg-base-300 text-content-300"; // Updated to use CDN classes
  }
}
