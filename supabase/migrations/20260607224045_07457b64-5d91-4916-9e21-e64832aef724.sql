
CREATE TABLE public.journalists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  byline_name text NOT NULL UNIQUE,
  specialization text NOT NULL,
  bio text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.journalists TO anon, authenticated;
GRANT ALL ON public.journalists TO service_role;

ALTER TABLE public.journalists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Journalists publicly readable"
  ON public.journalists FOR SELECT USING (true);

CREATE POLICY "Admins manage journalists"
  ON public.journalists FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.journalists (name, byline_name, specialization, bio) VALUES
('Ama Mensah','Ama Mensah','Economy','Senior economics correspondent covering fiscal policy, inflation, and central banking.'),
('Kwesi Boateng','Kwesi Boateng','Business','Business editor tracking corporate Ghana, banking sector, and private enterprise.'),
('Abena Owusu','Abena Owusu','Markets','Financial markets correspondent reporting on the GSE, commodity prices, and forex.'),
('Kofi Asante','Kofi Asante','Politics','Political affairs correspondent covering parliament, government policy, and governance.'),
('Nana Yaw Amoako','Nana Yaw Amoako','Politics','Policy analyst tracking regulatory reform, institutional change, and public administration.'),
('Grace Adjei','Grace Adjei','Politics','Investigative journalist focused on accountability, corruption cases, and EOCO proceedings.'),
('Samuel Darko','Samuel Darko','Energy','Energy sector correspondent reporting on oil, gas, electricity, and the mining sector.'),
('Akosua Boateng','Akosua Boateng','Energy','Environmental reporter covering galamsey, forestry policy, and natural resource management.'),
('Yaw Osei','Yaw Osei','Energy','Infrastructure correspondent tracking power supply, ECG, and grid expansion projects.'),
('Miriam Ankomah','Miriam Ankomah','Agriculture','Agriculture reporter covering cocoa production, food prices, and farming sector news.'),
('Benjamin Owusu-Ansah','Benjamin Owusu-Ansah','Agriculture','Agricultural economics correspondent tracking commodity markets and COCOBOD policy.'),
('Ransford Acheampong','Ransford Acheampong','Technology','Technology correspondent covering fintech, telecoms, digital payments, and innovation.'),
('Efua Sarpong','Efua Sarpong','Technology','Digital economy reporter tracking mobile money, startup ecosystem, and e-commerce.'),
('Kwame Kusi','Kwame Kusi','Trade','Trade and infrastructure reporter covering ports, roads, logistics, and manufacturing.'),
('Adwoa Mensah-Bonsu','Adwoa Mensah-Bonsu','Labour','Labour and employment correspondent reporting on wages, unions, and jobs data.'),
('Dr. Nana Asare','Dr. Nana Asare','Data','Data journalist and economist translating Ghana Statistical Service data into news.'),
('Ekow Quansah','Ekow Quansah','General','General assignment reporter covering breaking news across all sectors.'),
('Esi Larbi','Esi Larbi','General','News reporter covering daily Ghana developments, government announcements, and social policy.'),
('Nii Armah Tetteh','Nii Armah Tetteh','World','Africa and international correspondent covering regional economic and political developments.'),
('Abena Frimpong','Abena Frimpong','Research','Research and analysis correspondent covering academic reports, IMF, World Bank, and think tanks.');

CREATE OR REPLACE FUNCTION public.assign_journalist(p_category text, p_article_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pool text[];
  c text := lower(coalesce(p_category, ''));
  idx int;
BEGIN
  IF c ~ 'economy|macroeconomy|public-finance|labour' THEN
    pool := ARRAY['Ama Mensah','Nana Yaw Amoako','Adwoa Mensah-Bonsu'];
  ELSIF c ~ 'markets|stocks|forex|commodities' THEN
    pool := ARRAY['Abena Owusu','Dr. Nana Asare'];
  ELSIF c ~ 'business|banking|corporate|trade|industry' THEN
    pool := ARRAY['Kwesi Boateng','Kwame Kusi'];
  ELSIF c ~ 'politics|policy|regulation|governance' THEN
    pool := ARRAY['Kofi Asante','Nana Yaw Amoako','Grace Adjei'];
  ELSIF c ~ 'energy|mining|oil|utilities' THEN
    pool := ARRAY['Samuel Darko','Akosua Boateng','Yaw Osei'];
  ELSIF c ~ 'agriculture|cocoa|farming|food' THEN
    pool := ARRAY['Miriam Ankomah','Benjamin Owusu-Ansah'];
  ELSIF c ~ 'technology|digital|fintech|telecoms' THEN
    pool := ARRAY['Ransford Acheampong','Efua Sarpong'];
  ELSIF c ~ 'research|academic' THEN
    pool := ARRAY['Abena Frimpong','Dr. Nana Asare'];
  ELSIF c ~ 'data' THEN
    pool := ARRAY['Dr. Nana Asare'];
  ELSIF c ~ 'world|africa|international' THEN
    pool := ARRAY['Nii Armah Tetteh'];
  ELSE
    pool := ARRAY['Ekow Quansah','Esi Larbi'];
  END IF;
  idx := (('x' || substr(md5(p_article_id::text), 1, 8))::bit(32)::int & 2147483647) % array_length(pool, 1);
  RETURN pool[idx + 1];
END;
$$;

-- One-time backfill: replace generic StatsGH bylines with realistic journalists
UPDATE public.articles
SET author_name = public.assign_journalist(category_slug, id)
WHERE author_name IS NULL
   OR author_name IN (
     'StatsGH Newsroom','StatsGH Editor','StatsGH Data Desk',
     'StatsGH Editorial Team','StatsGH Editorial','StatsGH Senior Editor',
     'StatsGH Correspondent','StatsGH Reporter','StatsGH Editors',
     'StatsGH Data Unit','StatsGH Editorial Board','StatsGH News Desk',
     'StatsGH Staff','StatsGH Staff Writer','StatsGH','Newsroom'
   );
