const PROMPT = (bedrijf) => `Je bent een senior CSRD-expert. Analyseer het bedrijf "${bedrijf}" en voer een dubbele materialiteitsanalyse uit op ESRS subthema-niveau.

## Bedrijfsprofiel
Bepaal: bedrijfsnaam, omschrijving (2-3 zinnen), sector, subsector, sasb_sector, waardeketen (upstream/midstream/downstream/meerdere), geografie, omvang.

## Materialiteitsanalyse per SUBTHEMA

De beoordeling vindt plaats op subthema-niveau. Het thema erft zijn status: materieel als minstens één subthema materieel is, beperkt als minstens één beperkt maar geen materieel, anders niet-materieel.

Per subthema:
- impactNegatief (1-10): negatieve impact van het bedrijf op dit subthema
- impactPositief (1-10): positieve impact of bijdrage van het bedrijf
- financieelRisico (1-10): financieel risico voor het bedrijf
- financieelKans (1-10): financiële kans voor het bedrijf
- klasse: "materieel" als max(scores) ≥ 7, "beperkt" als max 4-6, "niet-materieel" als alle ≤ 3
- toelichting: 1-2 zinnen bedrijfsspecifiek
- bronnen: { mvo_risico, sasb, gri, msci, extra: [{naam, inhoud}] }
  Gebruik minimaal de 4 vaste bronnen. Voeg via extra[] relevante sectorrapportages, wetenschappelijke bronnen en beleidsdocumenten toe.

## Alle subthema's

E1: E1-1 Klimaatmitigatie (scope 1/2/3), E1-2 Klimaatadaptatie, E1-3 Energie (verbruik/mix/efficiëntie), E1-4 CO₂-verwijdering en -opslag
E2: E2-1 Uitstoot naar lucht (NOx/SOx/fijnstof/VOS), E2-2 Gevaarlijke stoffen in de lucht, E2-3 Geur en geluidshinder
E3: E3-1 Waterverbruik en -efficiëntie, E3-2 Watervervuiling (lozing/afvalwater), E3-3 Mariene en zoetwaterecosystemen
E4: E4-1 Directe oorzaken biodiversiteitsverlies (landgebruik/verstoring), E4-2 Impact op beschermde gebieden en soorten, E4-3 Ecosysteemfuncties en -diensten, E4-4 Invasieve soorten en genetische hulpbronnen
E5: E5-1 Grondstoffengebruik en circulariteit, E5-2 Afvalbeheer (gevaarlijk en niet-gevaarlijk), E5-3 Verpakking en producteinde-levensduur
S1: S1-1 Arbeidsomstandigheden en eerlijk loon, S1-2 Arbeidsgezondheid en -veiligheid, S1-3 Sociale dialoog en vakbondsrechten, S1-4 Gelijkheid diversiteit en inclusie, S1-5 Training ontwikkeling en human capital
S2: S2-1 Arbeidsomstandigheden bij leveranciers, S2-2 Veiligheid en gezondheid in de keten, S2-3 Kinderarbeid en gedwongen arbeid, S2-4 Vrijheid van vakvereniging in de keten
S3: S3-1 Rechten van lokale gemeenschappen en grondrechten, S3-2 Toegang tot essentiële voorzieningen, S3-3 Sociaaleconomische impact op regio's, S3-4 Rechten van inheemse volkeren
S4: S4-1 Productveiligheid en gezondheid, S4-2 Privacy en gegevensbescherming, S4-3 Transparante communicatie en misleiding, S4-4 Toegankelijkheid en kwetsbare groepen
G1: G1-1 Bedrijfscultuur en ethiek, G1-2 Bescherming van klokkenluiders, G1-3 Dierenwelzijn (indien relevant), G1-4 Betalingspraktijken
G2: G2-1 Preventie en detectie van corruptie, G2-2 Incidenten en handhaving, G2-3 Witwassen en financiële criminaliteit
G3: G3-1 Lobbyactiviteiten en politieke bijdragen, G3-2 Publieke beleidsposities en transparantie
G4: G4-1 Selectie en screening van leveranciers, G4-2 Contractuele duurzaamheidseisen, G4-3 Leveranciersmonitoring en audits

## Output
Geef ALLEEN geldige JSON, geen uitleg, geen markdown, geen backticks:
{"bedrijfsnaam":"...","omschrijving":"...","sector":"...","subsector":"...","sasb_sector":"...","waardeketen":"...","geografie":"...","omvang":"...","themas":[{"id":"E1","naam":"Klimaatverandering","cat":"E","klasse":"materieel","subthemas":[{"id":"E1-1","naam":"Klimaatmitigatie","impactNegatief":8,"impactPositief":2,"financieelRisico":9,"financieelKans":5,"klasse":"materieel","toelichting":"...","bronnen":{"mvo_risico":"...","sasb":"...","gri":"...","msci":"...","extra":[{"naam":"...","inhoud":"..."}]}}]}]}`;

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key niet geconfigureerd. Voeg ANTHROPIC_API_KEY toe aan Netlify Environment Variables." }) };
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
        model: "claude-opus-4-5",
        max_tokens: 8000,
        system: "Je bent een senior CSRD/ESG-materialiteitsexpert. Antwoord uitsluitend met geldige JSON zonder enige andere tekst of markdown.",
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
