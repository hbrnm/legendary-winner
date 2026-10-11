import { describe, expect, it } from "vitest";
import { buildIndex, normalize, search } from "./search";

const index = buildIndex([
  { id: "cartofi-albi", name: "Cartofi albi", terms: ["cartof", "cartofi"] },
  { id: "rosii", name: "Roșii", terms: ["tomate", "roșie"] },
  { id: "ceapa-verde", name: "Ceapă verde", terms: ["ceapă de primăvară"] },
  { id: "ceapa-galbena", name: "Ceapă galbenă", terms: ["ceapă"] },
  { id: "piept-pui", name: "Piept de pui", terms: ["file de pui", "fileu de pui"] },
  { id: "telemea-vaca", name: "Telemea de vacă", terms: ["brânză telemea"] },
  { id: "smantana", name: "Smântână", terms: ["smântână pentru gătit"] },
]);

const ids = (q: string) => search(index, q).map((h) => h.doc.id);

describe("căutare", () => {
  it("ignoră diacriticele și majusculele", () => {
    expect(normalize("Ţelină ŞI Brânză")).toBe("telina si branza");
    expect(ids("smantana")[0]).toBe("smantana");
    expect(ids("ROSII")[0]).toBe("rosii");
  });

  it("recunoaște sinonime și forme de singular/plural", () => {
    expect(ids("tomate")[0]).toBe("rosii");
    expect(ids("cartof")[0]).toBe("cartofi-albi");
    expect(ids("roșie")[0]).toBe("rosii");
    expect(ids("file de pui")[0]).toBe("piept-pui");
    expect(ids("branza telemea")[0]).toBe("telemea-vaca");
  });

  it("găsește după început de cuvânt", () => {
    expect(ids("cea")).toEqual(expect.arrayContaining(["ceapa-verde", "ceapa-galbena"]));
    expect(ids("ceapa")[0]).toBe("ceapa-galbena");
    expect(ids("ceapa verde")[0]).toBe("ceapa-verde");
  });

  it("tolerează o greșeală de tastare", () => {
    expect(ids("smantan")[0]).toBe("smantana");
    expect(ids("telemae")[0]).toBe("telemea-vaca");
  });

  it("nu întoarce nimic pentru căutare goală sau fără potrivire", () => {
    expect(ids("   ")).toEqual([]);
    expect(ids("xyzqw")).toEqual([]);
  });
});
