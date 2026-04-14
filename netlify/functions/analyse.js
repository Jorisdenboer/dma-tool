const PROMPT = (bedrijf) => `Je bent een CSRD-expert. Analyseer "${bedrijf}" en voer een dubbele materialiteitsanalyse uit.

Geef ALLEEN geldige JSON, geen uitleg, geen markdown, geen backticks.

Structuur:
{"bedrijfsnaam":"...","omschrijving":"2-3 zinnen over het bedrijf","sector":"...","subsector":"...","sasb_sector":"...","waardeketen":"...","geografie":"...","omvang":"...","themas":[{"id":"E1","naam":"Klimaatverandering","cat":"E","klasse":"materieel","subthemas":[{"id":"E1-1","naam":"Klimaatmitigatie","impactNegatief":8,"impactPositief":2,"financieelRisico":9,"financieelKans":5,"klasse":"materieel","toelichting":"1 zin bedrijfsspecifiek.","bronnen":{"mvo_risico":"1 zin.","sasb":"1 zin.","gri":"1 zin.","msci":"1 zin.","extra":[]}}]}]}

Alle 13 thema's met hun subthema's:
E1 Klimaatverandering: E1-1 Klimaatmitigatie, E1-2 Klimaatadaptatie, E1-3 Energie, E1-4 CO2-verwijdering
E2 Luchtvervuiling: E2-1 Uitstoot naar lucht, E2-2 Gevaarlijke stoffen lucht, E2-3 Geur en geluid
E3 Water en mariene hulpbronnen: E3-1 Waterverbruik, E3-2 Watervervuiling, E3-3 Mariene ecosystemen
E4 Biodiversiteit: E4-1 Biodiversiteitsverlies, E4-2 Beschermde gebieden, E4-3 Ecosysteemfuncties, E4-4 Invasieve soorten
E5 Circulaire economie: E5-1 Grondstoffengebruik, E5-2 Afvalbeheer, E5-3 Verpakking
S1 Eigen werknemers: S1-1 Arbeidsomstandigheden, S1-2 Veiligheid en gezondheid, S1-3 Vakbondsrechten, S1-4 Diversiteit, S1-5 Training
S2 Waardeketenmedewerkers: S2-1 Leveranciersarbeid, S2-2 Ketenveiligheid, S2-3 Kinderarbeid, S2-4 Vakvereniging keten
S3 Getroffen gemeenschappen: S3-1 Gemeenschapsrechten, S3-2 Essentiële voorzieningen, S3-3 Sociaaleconomische impact, S3-4 Inheemse volkeren
S4 Consumenten: S4-1 Productveiligheid, S4-2 Privacy, S4-3 Transparantie, S4-4 Toegankelijkheid
G1 Bedrijfsvoering: G1-1 Bedrijfscultuur, G1-2 Klokkenluiders, G1-3 Dierenwelzijn, G1-4 Betalingspraktijken
G2 Corruptie: G2-1 Corruptiepreventie, G2-2 Incidenten, G2-3 Witwassen
G3 Lobbyen: G3-1 Lobbyactiviteiten, G3-2 Beleidsposities
G4 Leveranciers: G4-1 Leveranciersselectie, G4-2 Duurzaamheidseisen, G4-3 Leveranciersmonitoring

Regels:
- klasse per subthema: "materieel" als max score >=7, "beperkt" als max 4-6, "niet-materieel" als alle <=3
- thema klasse erft van subthema's
- toelichting: max 1 zin per subthema
- bronnen: max 1 zin per bron, extra altijd lege array []
- Wees snel en bondig`;

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key niet geconfigureerd." }) };
  }

  let bedrijf;
  try {
    ({ bedrijf } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Ongeldige request body" }) };
  }

  if (!bedrijf) {
    return { statusCode: 400, body: JSON.stringify({ error: "Bedrijfsnaam ontbreekt" }) };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 6000,
        system: "Je bent een CSRD-expert. Antwoord uitsluitend met geldige JSON, geen tekst of markdown.",
        messages: [{ role: "user", content: PROMPT(bedrijf) }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return { statusCode: 500, body: JSON.stringify({ error: "Anthropic API fout: " + err }) };
    }

    const data = await response.json();
    const raw = data.content.filter(b => b.type === "text").map(b => b.text).join("");
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { statusCode: 500, body: JSON.stringify({ error: "Geen geldige JSON in antwoord" }) };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: match[0]
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
