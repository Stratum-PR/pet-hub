import { describe, expect, it } from "vitest";
import { reminderGreeting } from "./greeting.ts";

describe("reminderGreeting", () => {
  it("uses name when it is set", () => {
    expect(reminderGreeting({ name: "Ana Rivera", first_name: "Ana" })).toBe("Hola Ana Rivera");
  });

  it("trims name", () => {
    expect(reminderGreeting({ name: "  Ana  " })).toBe("Hola Ana");
  });

  it("falls back to first_name when name is empty, null or blank", () => {
    expect(reminderGreeting({ name: "", first_name: "Luis", last_name: "Ortiz" })).toBe("Hola Luis");
    expect(reminderGreeting({ name: null, first_name: " Luis " })).toBe("Hola Luis");
    expect(reminderGreeting({ name: "   ", first_name: "Luis" })).toBe("Hola Luis");
  });

  it("uses a neutral greeting with no trailing space when there is no name", () => {
    expect(reminderGreeting({ name: "", first_name: "" })).toBe("Hola,");
    expect(reminderGreeting({ name: null, first_name: null, last_name: "Ortiz" })).toBe("Hola,");
    expect(reminderGreeting(null)).toBe("Hola,");
    expect(reminderGreeting(undefined)).toBe("Hola,");
  });

  it("escapes HTML in the name", () => {
    expect(reminderGreeting({ name: "<b>Ana</b> & 'Co'" })).toBe("Hola &lt;b&gt;Ana&lt;/b&gt; &amp; &#39;Co&#39;");
    expect(reminderGreeting({ first_name: '"Luis"' })).toBe("Hola &quot;Luis&quot;");
  });
});
