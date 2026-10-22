// Secteurs de l'action publique, reconnus dans le titre d'un texte du JO et dans les codes qu'il modifie.
export const SECTEURS = [
  { id: "environnement", label: "Environnement et agriculture", re: /environnement|rural|agricol|phytopharm|pesticid|\beau\b|forêt|forestier|chasse|pêche|déchet|climat|biodiversit|énergie|pollution/i },
  { id: "urbanisme", label: "Urbanisme et logement", re: /urbanisme|construction|habitation|logement|permis de construire|aménagement|immobili/i },
  { id: "sante", label: "Santé", re: /santé|sanitaire|médic|hôpita|soins|pharmac|vaccin/i },
  { id: "securite", label: "Sécurité et police", re: /sécurité intérieure|police|pénal|ordre public|gendarmerie|défense|armes|vidéoprotection/i },
  { id: "collectivites", label: "Collectivités et élections", re: /collectivités territoriales|commune|municipal|départ(e|ement)|région|électora|élection|intercommunal/i },
  { id: "transports", label: "Route et transports", re: /\broute|routi|transport|circulation|véhicule|voirie|stationnement|ferroviaire|aérien/i },
  { id: "economie", label: "Économie et finances", re: /fiscal|impôt|budget|financ|commerce|entreprise|douane|taxe|marchés publics|commande publique/i },
  { id: "travail", label: "Travail et fonction publique", re: /travail|emploi|fonction publique|fonctionnaire|retraite|sécurité sociale|chômage/i },
] as const;

export type SecteurId = (typeof SECTEURS)[number]["id"];

export function secteursOf(text: string): SecteurId[] {
  return SECTEURS.filter((s) => s.re.test(text)).map((s) => s.id);
}
