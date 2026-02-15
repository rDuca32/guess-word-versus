import { LetterState } from "shared";

export function wordleFeedback(secret: string, guess: string): LetterState[] {
    const result: LetterState[] = Array(5).fill("absent");
    const secretArr = secret.split("");
    const guessArr = guess.split("");
    const secretUsed = Array(5).fill(false);

    // First pass: mark correct
    for (let i = 0; i < 5; i++) {
        if (guessArr[i] === secretArr[i]) {
            result[i] = "correct";
            secretUsed[i] = true;
        }
    }

    // Second pass: mark present
    for (let i = 0; i < 5; i++) {
        if (result[i] === "correct") continue;

        for (let j = 0; j < 5; j++) {
            if (!secretUsed[j] && guessArr[i] === secretArr[j]) {
                result[i] = "present";
                secretUsed[j] = true;
                break;
            }
        }
    }

    return result;

}