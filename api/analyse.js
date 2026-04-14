export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { bedrijf } = req.body;
  if (!bedrijf) return res.status(400).json({ error: "Bedrijfsnaam ontbreekt" });
  const apiKey = process.env.ANTHROPIC_API_KEY2;
  if (!apiKey) return res.status(500).json({ error: "API key niet geconfigureerd" });

  const prompt = `Analyseer bedrijf "${bedrijf}" voor CSRD dubbele materialiteitsanalyse.

Geef ALLEEN geldige JSON, geen uitleg, geen markdown:
{"bedrijfsnaam":"...","omschrijving":"...","sector":"...","subsector":"...","sasb_sector":"...","waardeketen":"...","geografie":"...","omvang":"...","themas":[{"id":"E1","naam":"Klimaatverandering","cat":"E","klasse":"materieel","subthemas":[{"id":"E1-1","naam":"Klimaatmitigatie","impactNegatief":8,"impactPositief":2,"financieelRisico":9,"financieelKans":5,"klasse":"materieel","toelichting":"...","bronnen":{"mvo_risico":"...","sasb":"...","gri":"...","msci":"...","extra":[{"naam":"...","inhoud":"..."}]}}]}]}

Verwerk alle 13 thema's: E1 (E1-1 t/m E1-4), E2 (E2-1 t/m E2-3), E3 (E3-1 t/m E3-3), E4 (E4-1 t/m E4-4), E5 (E5-1 t/m E5-3), S1 (S1-1 t/m S1-5), S2 (S2-1 t/m S2-4), S3 (S3-1 t/m S3-4), S4 (S4-1 t/m S4-4), G1 (G1-1 t/m G1-4), G2 (G2-1 t/m G2-3), G3 (G3-1 t/m G3-2), G4 (G4-1 t/m G4-3).

Houd toelichtingen kort (1 zin). Houd bronomschrijvingen kort (1 zin). Maximaal 1 extra bron per subthema.`;

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
        max_tokens: 16000,
        system: "Je bent een CSRD-expert. Antwoord uitsluitend met geldige JSON zonder andere tekst of markdown. Houd alle tekstvelden zo kort mogelijk.",
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
