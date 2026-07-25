export class WebNNEngine {
    isSupported: boolean = false;
    async init() {
        if ('ml' in navigator) {
            this.isSupported = true;
        }
    }
    async compileModel(data: any) {
        return data; // Mock for now
    }
}
