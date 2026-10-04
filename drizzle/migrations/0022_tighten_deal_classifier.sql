CREATE OR REPLACE FUNCTION public.classify_deal_type(p_title text, p_summary text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN t ~* '\m(football|transfer fee|striker|midfielder|defender|goalkeeper|premier league|la liga|barca|barcelona|newcastle|chelsea|arsenal|club|athlete|boxing)\M' THEN NULL
    WHEN t ~* '\meurobonds?\M' AND h ~* 'eurobond|bond|issu|rais|tap|buyback' THEN 'eurobond'
    WHEN h ~* '\mIPO\M|initial public offering|lists? on the (GSE|Ghana Stock Exchange)|new listing' THEN 'ipo'
    WHEN h ~* '\macqui(re|res|red|sition|sitions)\M|\mmergers?\M|\mmerge\M|\mtakeover|buys? .{0,20}stake|sells? .{0,20}stake|\mdivest' THEN 'm_and_a'
    WHEN t ~* '\m(corporate|green|domestic|infrastructure|sukuk) bonds?\M|\mbonds?\M.{0,40}(issu|rais|programme|offer)|(issu|rais|offer)\w*.{0,40}\mbonds?\M|note programme' THEN 'bond'
    WHEN t ~* 'rights issue|private placement|capital rais|raises? (us\$|gh₵|\$|ghs)|equity rais|secures? .{0,40}(funding|financing|loan facility|investment)' THEN 'capital_raise'
    WHEN h ~* '(award|win|sign|secure)\w* .{0,40}contract|contract (worth|valued)' THEN 'contract'
  END
  FROM (SELECT coalesce(p_title,'') AS h, coalesce(p_title,'') || ' ' || coalesce(p_summary,'') AS t) s
$$;