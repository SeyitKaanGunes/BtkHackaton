import { describe, expect, it } from "vitest";
import { categories } from "./category-catalog.js";

describe("category catalog", () => {
  it("keeps salary and one-time income categories available by default", () => {
    const incomeCategories = categories.filter((category) => category.kind === "income");

    expect(incomeCategories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cat-salary", name: "Maaş" }),
        expect.objectContaining({ id: "cat-other-income", name: "Diğer gelir" })
      ])
    );
  });
});
