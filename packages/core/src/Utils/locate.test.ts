import { pt, ptBR, de, enUS, enGB, arSA } from "date-fns/locale";
import { getLocale } from "./locate";

describe("getLocale", () => {
  test("maps pt / pt-PT to European Portuguese and pt-BR to Brazilian Portuguese", () => {
    expect(getLocale("pt")).toBe(pt);
    expect(getLocale("pt-PT")).toBe(pt);
    expect(getLocale("pt-BR")).toBe(ptBR);
    expect(getLocale("ptBR")).toBe(ptBR);
  });

  test("keeps legacy date-fns export names working", () => {
    expect(getLocale("enGB")).toBe(enGB);
    expect(getLocale("arSA")).toBe(arSA);
    expect(getLocale("de")).toBe(de);
  });

  test("is case-insensitive and falls back to the base language by region", () => {
    expect(getLocale("PT-pt")).toBe(pt);
    expect(getLocale("pt_br")).toBe(ptBR);
    expect(getLocale("de-AT")).toBe(de);
    expect(getLocale("en-GB")).toBe(enGB);
  });

  test("defaults to enUS for missing or unknown languages", () => {
    expect(getLocale()).toBe(enUS);
    expect(getLocale("xx-XX")).toBe(enUS);
  });
});
