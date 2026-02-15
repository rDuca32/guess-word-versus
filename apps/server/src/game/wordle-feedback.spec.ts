import { wordleFeedback } from "./wordle-feedback";

describe("wordleFeedback", () => {
    it("marks all correct", () => {
        expect(wordleFeedback("apple", "apple")).toEqual([
            "correct", "correct", "correct", "correct", "correct"
        ]);
    });

    it("marks present and absent", () => {
        expect(wordleFeedback("apple", "plead")).toEqual([
            "present", "present", "present", "present", "absent"
        ]);
    });

    it("handles repeated letters correctly", () => {
        expect(wordleFeedback("apple", "allee")).toEqual([
            "correct", "present", "absent", "absent", "correct"
        ]);
        expect(wordleFeedback("level", "lemon")).toEqual([
            "correct", "correct", "absent", "absent", "absent"
        ]);
        expect(wordleFeedback("boost", "boots")).toEqual([
            "correct", "correct", "correct", "present", "present"
        ]);
    });

    it("handles no matches", () => {
        expect(wordleFeedback("apple", "zzzzz")).toEqual([
            "absent", "absent", "absent", "absent", "absent"
        ]);
    });
});

