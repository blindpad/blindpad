export function debounce(func: () => any, wait: number) {
    let timeoutId: number = null;
    const later = () => {
        timeoutId = null;
        func();
    };
    return () => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        timeoutId = self.setTimeout(later, wait);
    };
}
