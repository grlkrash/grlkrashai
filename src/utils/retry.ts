export async function retry<T>(
    attempts: number,
    fn: () => Promise<T>,
    delay = 1000
): Promise<T> {
    let lastError: any = null; 
    for (let i = 0; i < attempts; i++) {
        try {
            // Attempt the function call
            // console.log(`Retry: Attempt <span class="math-inline">\{i \+ 1\}/</span>{attempts}...`); // Optional: Add for debugging
            return await fn(); 
        } catch (error: any) {
            // Store the error
            lastError = error;
            // If it's the last attempt, break the loop (the error will be thrown after)
            if (i === attempts - 1) {
                // console.error(`Retry: Final attempt (${i + 1}) failed.`); // Optional: Add for debugging
                break; 
            }
            // If not the last attempt, wait for the delay before the next iteration
            // console.warn(`Retry: Attempt ${i + 1} failed. Retrying in ${delay}ms...`, { message: error?.message }); // Optional: Add for debugging
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    // If the loop finished, it means all attempts failed. Throw the last error caught.
    // Add a fallback generic error just in case lastError is somehow null (shouldn't happen if attempts > 0).
    // console.error("Retry: All attempts failed. Throwing last error:", lastError); // Optional: Add for debugging
    throw lastError ?? new Error('Retry function completed all attempts but lastError was null.'); 
}