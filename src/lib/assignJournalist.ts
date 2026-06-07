// Deterministic journalist assignment — mirrors public.assign_journalist() in Postgres.
// Same article ID always returns the same byline.

type Pool = string[];

function poolFor(categorySlug: string): Pool {
  const c = (categorySlug || "").toLowerCase();
  if (/economy|macroeconomy|public-finance|labour/.test(c)) return ["Ama Mensah", "Nana Yaw Amoako", "Adwoa Mensah-Bonsu"];
  if (/markets|stocks|forex|commodities/.test(c)) return ["Abena Owusu", "Dr. Nana Asare"];
  if (/business|banking|corporate|trade|industry/.test(c)) return ["Kwesi Boateng", "Kwame Kusi"];
  if (/politics|policy|regulation|governance/.test(c)) return ["Kofi Asante", "Nana Yaw Amoako", "Grace Adjei"];
  if (/energy|mining|oil|utilities/.test(c)) return ["Samuel Darko", "Akosua Boateng", "Yaw Osei"];
  if (/agriculture|cocoa|farming|food/.test(c)) return ["Miriam Ankomah", "Benjamin Owusu-Ansah"];
  if (/technology|digital|fintech|telecoms/.test(c)) return ["Ransford Acheampong", "Efua Sarpong"];
  if (/research|academic/.test(c)) return ["Abena Frimpong", "Dr. Nana Asare"];
  if (/data/.test(c)) return ["Dr. Nana Asare"];
  if (/world|africa|international/.test(c)) return ["Nii Armah Tetteh"];
  return ["Ekow Quansah", "Esi Larbi"];
}

// djb2 hash (deterministic, no crypto needed)
function hashSeed(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function assignJournalist(categorySlug: string, seed: string): string {
  const pool = poolFor(categorySlug);
  if (pool.length === 1) return pool[0];
  return pool[hashSeed(seed) % pool.length];
}
