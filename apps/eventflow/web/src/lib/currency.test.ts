import { describe, it } from "node:test";
import assert from "node:assert";
import {
  formatCurrencyPt,
  eurosToCents,
  centsToEuros,
  applyCurrencyKeyPress,
  parsePastedCurrency,
} from "./currency";

describe("CFM Events: Currency Formatting & Cent-Shift Input Rules", () => {
  it("formats decimal euro amounts in Portuguese convention with comma", () => {
    assert.equal(formatCurrencyPt(1.29), "1,29");
    assert.equal(formatCurrencyPt(129), "129,00");
    assert.equal(formatCurrencyPt(0.05), "0,05");
    assert.equal(formatCurrencyPt(0), "0,00");
    assert.equal(formatCurrencyPt(2450.5), "2450,50");
  });

  it("shifts cents into place as user types digits: typing 129 produces 1,29€", () => {
    let cents = 0;

    // User types '1'
    cents = applyCurrencyKeyPress(cents, "1")!;
    assert.equal(cents, 1);
    assert.equal(formatCurrencyPt(centsToEuros(cents)), "0,01");

    // User types '2'
    cents = applyCurrencyKeyPress(cents, "2")!;
    assert.equal(cents, 12);
    assert.equal(formatCurrencyPt(centsToEuros(cents)), "0,12");

    // User types '9' -> total is 129 cents = 1,29€
    cents = applyCurrencyKeyPress(cents, "9")!;
    assert.equal(cents, 129);
    assert.equal(centsToEuros(cents), 1.29);
    assert.equal(formatCurrencyPt(centsToEuros(cents)), "1,29");
  });

  it("requires adding missing zeroes to reach 129€ (typing 12900 produces 129,00€)", () => {
    let cents = 129; // Starts at 1,29€

    // User adds first zero
    cents = applyCurrencyKeyPress(cents, "0")!;
    assert.equal(cents, 1290);
    assert.equal(formatCurrencyPt(centsToEuros(cents)), "12,90");

    // User adds second zero -> 129,00€
    cents = applyCurrencyKeyPress(cents, "0")!;
    assert.equal(cents, 12900);
    assert.equal(centsToEuros(cents), 129.00);
    assert.equal(formatCurrencyPt(centsToEuros(cents)), "129,00");
  });

  it("handles backspace by shifting digits off the cents place", () => {
    let cents = 12900; // 129,00€

    cents = applyCurrencyKeyPress(cents, "Backspace")!;
    assert.equal(cents, 1290);
    assert.equal(formatCurrencyPt(centsToEuros(cents)), "12,90");

    cents = applyCurrencyKeyPress(cents, "Backspace")!;
    assert.equal(cents, 129);
    assert.equal(formatCurrencyPt(centsToEuros(cents)), "1,29");

    cents = applyCurrencyKeyPress(cents, "Backspace")!;
    assert.equal(cents, 12);
    assert.equal(formatCurrencyPt(centsToEuros(cents)), "0,12");

    cents = applyCurrencyKeyPress(cents, "Backspace")!;
    assert.equal(cents, 1);
    assert.equal(formatCurrencyPt(centsToEuros(cents)), "0,01");

    cents = applyCurrencyKeyPress(cents, "Backspace")!;
    assert.equal(cents, 0);
    assert.equal(formatCurrencyPt(centsToEuros(cents)), "0,00");
  });

  it("resets when replacing full selection", () => {
    let cents = 12900;
    // User selected all and typed '5'
    cents = applyCurrencyKeyPress(cents, "5", true)!;
    assert.equal(cents, 5);
    assert.equal(formatCurrencyPt(centsToEuros(cents)), "0,05");

    // User selected all and hit backspace
    cents = applyCurrencyKeyPress(cents, "Backspace", true)!;
    assert.equal(cents, 0);
    assert.equal(formatCurrencyPt(centsToEuros(cents)), "0,00");
  });

  it("parses pasted values correctly", () => {
    // Pasted with comma
    assert.equal(parsePastedCurrency("1,29"), 129);
    assert.equal(parsePastedCurrency("1,29€"), 129);
    // Pasted with dot
    assert.equal(parsePastedCurrency("129.00"), 12900);
    // Pasted raw digits without decimal
    assert.equal(parsePastedCurrency("129"), 129);
  });
});
