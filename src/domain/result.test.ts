import { err, ok } from "./result";

describe("Result", () => {
  it("porte une valeur quand l’opération réussit", () => {
    expect(ok(3)).toEqual({ ok: true, value: 3 });
  });

  it("porte un code d’erreur sans valeur associée", () => {
    expect(err("missing")).toEqual({ ok: false, error: "missing" });
  });
});
