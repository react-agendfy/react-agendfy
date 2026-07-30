import { en, pt, ptBR, es, fr, ar, getMessages, getTextDirection, formatMessage } from "./index";

describe("i18n message catalog", () => {
  test("defaults to English for missing or unknown languages", () => {
    expect(getMessages()).toBe(en);
    expect(getMessages("xx")).toBe(en);
    expect(getMessages("de-AT")).toBe(en); // no de catalog yet → en
    expect(getMessages("en")).toBe(en);
    expect(getMessages("en-GB")).toBe(en);
  });

  test("resolves pt to European Portuguese and pt-BR to Brazilian Portuguese", () => {
    expect(getMessages("pt")).toBe(pt);
    expect(getMessages("pt-PT")).toBe(pt);
    expect(getMessages("pt-BR")).toBe(ptBR);
    expect(getMessages("ptBR")).toBe(ptBR);
    expect(getMessages("pt_br")).toBe(ptBR);
  });

  test("is case-insensitive and falls back to the base language by region", () => {
    expect(getMessages("PT-pt")).toBe(pt);
    expect(getMessages("PT-BR")).toBe(ptBR);
    expect(getMessages("es-MX")).toBe(es);
    expect(getMessages("fr-CA")).toBe(fr);
    expect(getMessages("ar-EG")).toBe(ar);
  });

  test("every catalog defines every key from the English source of truth", () => {
    const keys = Object.keys(en).sort();
    [pt, ptBR, es, fr, ar].forEach((catalog) => {
      expect(Object.keys(catalog).sort()).toEqual(keys);
    });
  });

  describe("getTextDirection", () => {
    test("returns rtl for RTL languages (any region)", () => {
      expect(getTextDirection("ar")).toBe("rtl");
      expect(getTextDirection("ar-EG")).toBe("rtl");
      expect(getTextDirection("arSA")).toBe("rtl");
      expect(getTextDirection("he")).toBe("rtl");
      expect(getTextDirection("faIR")).toBe("rtl");
      expect(getTextDirection("ur")).toBe("rtl");
    });

    test("returns ltr otherwise", () => {
      expect(getTextDirection()).toBe("ltr");
      expect(getTextDirection("en")).toBe("ltr");
      expect(getTextDirection("pt-BR")).toBe("ltr");
    });
  });

  describe("formatMessage", () => {
    test("fills placeholders", () => {
      expect(
        formatMessage("{title} starts at {time}", { title: "Standup", time: "09:00" }, "")
      ).toBe("Standup starts at 09:00");
    });

    test("uses the fallback when the template is missing", () => {
      expect(formatMessage(undefined, { days: 7 }, "next {days} days")).toBe(
        "next 7 days"
      );
    });

    test("leaves unknown placeholders intact", () => {
      expect(formatMessage("hello {name}", {}, "")).toBe("hello {name}");
    });
  });
});
