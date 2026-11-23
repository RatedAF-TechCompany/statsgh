import { assertEquals } from "jsr:@std/assert@1";
import { houseRuleIssues, applyHouseFixes, countBodyWords, backlogFreshnessLimit, backlogHours } from "./retry.ts";
import { backoffDelayMs } from "../_shared/ai-gateway.ts";

Deno.test("house rule issues", () => {
  assertEquals(houseRuleIssues({ headline: "Ghana: rates", body_html: "<p>x</p>" }), ["colon in headline"]);
  assertEquals(houseRuleIssues({ headline: "Ghana rates", body_html: "<p>according to the BoG</p>" }), ["'according to'"]);
  assertEquals(houseRuleIssues({ headline: "Ghana rates", body_html: "<p>JoyBiz reported</p>" }, "JoyBiz"), ["outlet name (JoyBiz)"]);
  assertEquals(houseRuleIssues({ headline: "Ghana rates", body_html: "<p>The Bank of Ghana said</p>" }, "Bank of Ghana — News"), []);
  assertEquals(houseRuleIssues({ headline: "Ghana rates", body_html: '<p><a href="x">y</a> #Ghana</p>' }), ["link", "hashtag"]);
});
Deno.test("house fixes", () => {
  const g = applyHouseFixes({ headline: "Ghana: GHS 5bn plan", body_html: '<p><a href="https://x">BoG</a> #cedi</p>' });
  assertEquals(g.headline, "Ghana GHS 5bn plan");
  assertEquals(g.body_html, "<p>BoG cedi</p>");
  assertEquals(houseRuleIssues(g), []);
});
Deno.test("words and windows", () => {
  assertEquals(countBodyWords("<p>one two</p><p>three</p>"), 3);
  assertEquals(backlogFreshnessLimit("recovery"), 1440);
  assertEquals(backlogFreshnessLimit("scheduled"), 720);
  assertEquals(backlogHours("recovery"), 24);
  assertEquals(backlogHours("scheduled"), 12);
});
Deno.test("backoff", () => {
  assertEquals(backoffDelayMs(0, null, () => 0), 2000);
  assertEquals(backoffDelayMs(1, null, () => 0), 4000);
  assertEquals(backoffDelayMs(2, null, () => 0), 8000);
  assertEquals(backoffDelayMs(5, null, () => 0), 10000);
  assertEquals(backoffDelayMs(0, "3", () => 0), 3000);
  assertEquals(backoffDelayMs(0, "60", () => 0), 10000);
});
