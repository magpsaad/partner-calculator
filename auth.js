// Authentication and Workspace Management
class WorkspaceAuth {
    constructor() {
        this.currentWorkspaceId = null;
        this.db = null;
        this.unsubscribe = null;
    }

    init() {
        if (typeof firebase === 'undefined') {
            console.error('Firebase not initialized');
            return;
        }
        this.db = firebase.firestore();
        
        // Check if workspace ID is in sessionStorage
        const savedWorkspaceId = sessionStorage.getItem('workspaceId');
        if (savedWorkspaceId) {
            this.currentWorkspaceId = savedWorkspaceId;
        }
    }

    // Generate a unique workspace ID
    generateWorkspaceId() {
        return 'ws_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Simple password hashing (for client-side, consider using a library like crypto-js)
    async hashPassword(password) {
        // Using Web Crypto API for hashing
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Create a new workspace
    async createWorkspace(password) {
        if (!this.db) {
            throw new Error('Firebase not initialized');
        }

        const workspaceId = this.generateWorkspaceId();
        const passwordHash = await this.hashPassword(password);

        const workspaceData = {
            settings: {
                partnerAName: 'Partner A',
                partnerBName: 'Partner B'
            },
            projects: [],
            passwordHash: passwordHash,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await this.db.collection('workspaces').doc(workspaceId).set(workspaceData);
            this.currentWorkspaceId = workspaceId;
            sessionStorage.setItem('workspaceId', workspaceId);
            return { workspaceId, success: true };
        } catch (error) {
            console.error('Error creating workspace:', error);
            throw error;
        }
    }

    // Verify password and load workspace
    async loginWorkspace(workspaceId, password) {
        if (!this.db) {
            throw new Error('Firebase not initialized');
        }

        try {
            const workspaceDoc = await this.db.collection('workspaces').doc(workspaceId).get();
            
            if (!workspaceDoc.exists) {
                throw new Error('Workspace not found');
            }

            const workspaceData = workspaceDoc.data();
            const passwordHash = await this.hashPassword(password);

            if (workspaceData.passwordHash !== passwordHash) {
                throw new Error('Incorrect password');
            }

            this.currentWorkspaceId = workspaceId;
            sessionStorage.setItem('workspaceId', workspaceId);
            return { success: true, data: workspaceData };
        } catch (error) {
            console.error('Error logging in:', error);
            throw error;
        }
    }

    // Get workspace reference
    getWorkspaceRef() {
        if (!this.currentWorkspaceId || !this.db) {
            return null;
        }
        return this.db.collection('workspaces').doc(this.currentWorkspaceId);
    }

    // Subscribe to real-time updates
    subscribeToWorkspace(callback) {
        if (!this.currentWorkspaceId || !this.db) {
            return null;
        }

        const workspaceRef = this.getWorkspaceRef();
        this.unsubscribe = workspaceRef.onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                callback(data);
            }
        }, (error) => {
            console.error('Error listening to workspace:', error);
        });

        return this.unsubscribe;
    }

    // Unsubscribe from updates
    unsubscribeFromWorkspace() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    // Save workspace data
    async saveWorkspace(data) {
        if (!this.currentWorkspaceId || !this.db) {
            throw new Error('No workspace selected');
        }

        try {
            const workspaceRef = this.getWorkspaceRef();
            await workspaceRef.update({
                ...data,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('Error saving workspace:', error);
            throw error;
        }
    }

    // Logout
    logout() {
        this.unsubscribeFromWorkspace();
        this.currentWorkspaceId = null;
        sessionStorage.removeItem('workspaceId');
    }

    // Get shareable link
    getShareableLink(workspaceId) {
        const wsId = workspaceId || this.currentWorkspaceId;
        if (!wsId) {
            return null;
        }
        const baseUrl = window.location.origin + window.location.pathname.replace('login.html', 'login.html');
        return `${baseUrl}?workspace=${wsId}`;
    }
}
