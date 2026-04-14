export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { bedrijf } = req.body;
  if (!bedrijf) return res.status(400).json({ error: "Bedrijfsnaam ontbreekt" });
  const apiKey = process.env.ANTHROPIC_API_KEY2;
  if (!apiKey) return res.status(500).json({ error: "API key niet geconfigureerd" });

  const prompt = `Je bent een senior CSRD-expert. Analyseer het bedrijf "${bedrijf}" en voer een dubbele materialiteitsanalyse uit op ESRS subthema-niveau.

Bedrijfsprofiel: bepaal bedrijfsnaam, omschrijving (2-3 zinnen), sector, subsector, sasb_sector, waardeketen, geografie, omvang.

Per subthema: impactNegatief (1-10), impactPositief (1-10), financieelRisico (1-10), financieelKans (1-10), klasse (materieel/beperkt/niet-materieel), toelichting (1-2 zinnen), bronnen (mvo_risico, sasb, gri, msci, extra:[{naam,inhoud}]).

Subthema's:
E1: E1-1 Klimaatmitigatie, E1-2 Klimaatadaptatie, E1-3 Energie, E1-4 CO2-verwijdering
E2: E2-1 Uitstoot naar lucht, E2-2 Gevaarlijke stoffen lucht, E2-3 Geur en geluid
E3: E3-1 Waterverbruik, E3-2 Watervervuiling, E3-3 Mariene ecosystemen
E4: E4-1 Biodiversiteitsverlies, E4-2 Beschermde gebieden, E4-3 Ecosysteemfuncties, E4-4 Invasieve soorten
E5: E5-1 Grondstoffengebruik, E5-2 Afvalbeheer, E5-3 Verpakking
S1: S1-1 Arbeidsomstandigheden, S1-2 Arbeidsveiligheid, S1-3 Vakbondsrechten, S1-4 Diversiteit, S1-5 Training
S2: S2-1 Leveranciersarbeid, S2-2 Ketenveiligheid, S2-3 Kinderarbeid, S2-4 Vakvereniging keten
S3: S3-1 Gemeenschapsrechten, S3-2 Essentiële voorzieningen, S3-3 Sociaaleconomische impact, S3-4 Inheemse volkeren
S4: S4-1 Productveiligheid, S4-2 Privacy, S4-3 Transparantie, S4-4 Toegankelijkheid
G1: G1-1 Bedrijfscultuur, G1-2 Klokkenluiders, G1-3 Dierenwelzijn, G1-4 Betalingspraktijken
G2: G2-1 Corruptiepreventie, G2-2 Incidenten, G2-3 Witwassen
G3: G3-1 Lobbyactiviteiten, G3-2 Beleidsposities
G4: G4-1 Leveranciersselectie, G4-2 Duurzaamheidseisen, G4-3 Leveranciersmonitoring

Geef ALLEEN geldige JSON, geen uitleg, geen markdown:
{"bedrijfsnaam":"...","omschrijving":"...","sector":"...","subsector":"...","sasb_sector":"...","waardeketen":"...","geografie":"...","omvang":"...","themas":[{"id":"E1","naam":"Klimaatverandering","cat":"E","klasse":"materieel","subthemas":[{"id":"E1-1","naam":"Klimaatmitigatie","impactNegatief":8,"impactPositief":2,"financieelRisico":9,"financieelKans":5,"klasse":"materieel","toelichting":"...","bronnen":{"mvo_risico":"...","sasb":"...","gri":"...","msci":"...","extra":[{"naam":"...","inhoud":"..."}]}}]}]}`;

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
        max_tokens: 8000,
        system: "Je bent een senior CSRD/ESG-materialiteitsexpert. Antwoord uitsluitend met geldige JSON zonder enige andere tekst of markdown.",
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: "Anthropic API fout: " + err });
    }

    const data = await response.json();
    const raw = data.content.filter(b => b.type === "text").map(b => b.text).join("");
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: "Geen JSON gevonden" });

    res.status(200).json(JSON.parse(match[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
