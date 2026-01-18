// Business Calculator Application with Firebase Backend
class BusinessCalculator {
    constructor() {
        this.workspaceAuth = new WorkspaceAuth();
        this.workspaceAuth.init();
        this.projects = [];
        this.settings = { partnerAName: 'Partner A', partnerBName: 'Partner B' };
        this.currentProjectId = null;
        this.currentTab = 'all';
        this.isSyncing = false;
        this.syncUnsubscribe = null;
        this.init();
    }

    async init() {
        // Check if user is logged in
        const workspaceId = sessionStorage.getItem('workspaceId');
        if (!workspaceId) {
            window.location.href = 'login.html';
            return;
        }

        this.workspaceAuth.currentWorkspaceId = workspaceId;

        // Load data from Firestore
        await this.loadData();

        // Set up real-time listener
        this.setupRealtimeListener();

        // Set today's date as default for date inputs
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('expenseDate').value = today;
        document.getElementById('revenueDate').value = today;

        // Update partner names in forms
        this.updatePartnerNamesInForms();

        // Event listeners
        document.getElementById('expenseForm').addEventListener('submit', (e) => this.handleExpenseSubmit(e));
        document.getElementById('revenueForm').addEventListener('submit', (e) => this.handleRevenueSubmit(e));
        
        // New Project button
        const newProjectBtn = document.getElementById('newProjectBtn');
        if (newProjectBtn) {
            newProjectBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('New project button clicked');
                this.showNewProjectModal();
            });
        } else {
            console.error('newProjectBtn not found');
        }
        
        document.getElementById('createProjectBtn').addEventListener('click', () => this.createProject());
        document.getElementById('cancelNewProjectBtn').addEventListener('click', () => this.hideNewProjectModal());
        document.getElementById('closeNewProjectBtn').addEventListener('click', () => this.hideNewProjectModal());
        document.getElementById('saveProjectBtn').addEventListener('click', () => this.saveProjectEdit());
        document.getElementById('cancelEditProjectBtn').addEventListener('click', () => this.hideEditProjectModal());
        document.getElementById('closeEditProjectBtn').addEventListener('click', () => this.hideEditProjectModal());
        document.getElementById('deleteProjectFromModalBtn').addEventListener('click', () => this.deleteProjectFromModal());
        
        // Settings button
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Settings button clicked');
                this.showSettingsModal();
            });
        } else {
            console.error('settingsBtn not found');
        }
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
        document.getElementById('cancelSettingsBtn').addEventListener('click', () => this.hideSettingsModal());
        document.getElementById('closeSettingsBtn').addEventListener('click', () => this.hideSettingsModal());
        document.getElementById('markSettledBtn').addEventListener('click', () => this.toggleSettlement());
        document.getElementById('clearProjectBtn').addEventListener('click', () => this.clearProjectData());
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
        document.getElementById('editProjectBtn')?.addEventListener('click', () => {
            if (this.currentProjectId) {
                this.editProject(this.currentProjectId);
            }
        });
        document.getElementById('deleteProjectBtn')?.addEventListener('click', () => {
            if (this.currentProjectId) {
                this.deleteProject(this.currentProjectId);
            }
        });
        document.getElementById('projectSelector')?.addEventListener('change', (e) => {
            const projectId = parseInt(e.target.value);
            if (projectId) {
                this.selectProject(projectId);
            } else {
                this.currentProjectId = null;
                this.showNoProjectState();
            }
        });
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Modal close on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideNewProjectModal();
                this.hideSettingsModal();
                this.hideEditProjectModal();
            }
        });

        // Initial render
        this.renderProjectList();
        if (this.currentProjectId) {
            this.selectProject(this.currentProjectId);
        } else {
            this.showNoProjectState();
        }
    }

    setupRealtimeListener() {
        this.syncUnsubscribe = this.workspaceAuth.subscribeToWorkspace((data) => {
            // Update local data when remote changes occur
            if (data) {
                this.projects = data.projects || [];
                this.settings = data.settings || { partnerAName: 'Partner A', partnerBName: 'Partner B' };
                
                // Update UI
                this.updatePartnerNamesInForms();
                this.renderProjectList();
                
                // If current project still exists, refresh it
                if (this.currentProjectId) {
                    const project = this.projects.find(p => p.id === this.currentProjectId);
                    if (project) {
                        this.updateDisplay();
                    } else {
                        this.showNoProjectState();
                    }
                }
            }
        });
    }

    async loadData() {
        try {
            const workspaceRef = this.workspaceAuth.getWorkspaceRef();
            if (!workspaceRef) {
                throw new Error('No workspace selected');
            }

            const doc = await workspaceRef.get();
            if (doc.exists) {
                const data = doc.data();
                this.projects = data.projects || [];
                this.settings = data.settings || { partnerAName: 'Partner A', partnerBName: 'Partner B' };
                this.currentProjectId = data.currentProjectId || null;
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data. Please refresh the page.');
        }
    }

    async saveData() {
        if (this.isSyncing) return; // Prevent concurrent saves
        
        this.isSyncing = true;
        this.updateSyncIndicator(true);

        try {
            const workspaceRef = this.workspaceAuth.getWorkspaceRef();
            if (!workspaceRef) {
                throw new Error('No workspace selected');
            }

            await workspaceRef.update({
                projects: this.projects,
                settings: this.settings,
                currentProjectId: this.currentProjectId,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Small delay to show sync indicator
            setTimeout(() => {
                this.isSyncing = false;
                this.updateSyncIndicator(false);
            }, 300);
        } catch (error) {
            console.error('Error saving data:', error);
            this.isSyncing = false;
            this.updateSyncIndicator(false);
            this.showError('Failed to save. Changes may not be synced.');
        }
    }

    updateSyncIndicator(syncing) {
        let indicator = document.getElementById('syncIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'syncIndicator';
            indicator.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 10px 15px; background: white; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 1000; display: flex; align-items: center; gap: 8px;';
            document.body.appendChild(indicator);
        }

        if (syncing) {
            indicator.innerHTML = '<span style="color: #667eea;">⏳</span> <span>Syncing...</span>';
            indicator.style.display = 'flex';
        } else {
            indicator.innerHTML = '<span style="color: #27ae60;">✓</span> <span>Synced</span>';
            setTimeout(() => {
                indicator.style.display = 'none';
            }, 2000);
        }
    }

    showError(message) {
        // Simple error notification
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 15px 20px; background: #e74c3c; color: white; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 1001;';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    }

    updatePartnerNamesInForms() {
        const expensePartnerA = document.getElementById('expensePartnerA');
        const expensePartnerB = document.getElementById('expensePartnerB');
        const revenuePartnerA = document.getElementById('revenuePartnerA');
        const revenuePartnerB = document.getElementById('revenuePartnerB');
        
        if (expensePartnerA) {
            expensePartnerA.textContent = this.settings.partnerAName;
            expensePartnerA.value = this.settings.partnerAName;
        }
        if (expensePartnerB) {
            expensePartnerB.textContent = this.settings.partnerBName;
            expensePartnerB.value = this.settings.partnerBName;
        }
        if (revenuePartnerA) {
            revenuePartnerA.textContent = this.settings.partnerAName;
            revenuePartnerA.value = this.settings.partnerAName;
        }
        if (revenuePartnerB) {
            revenuePartnerB.textContent = this.settings.partnerBName;
            revenuePartnerB.value = this.settings.partnerBName;
        }
    }

    getCurrentProject() {
        return this.projects.find(p => p.id === this.currentProjectId);
    }

    getTransactions() {
        const project = this.getCurrentProject();
        return project ? project.transactions : [];
    }

    async handleExpenseSubmit(e) {
        e.preventDefault();
        const project = this.getCurrentProject();
        if (!project) {
            alert('Please select a project first.');
            return;
        }
        if (project.isSettled) {
            if (!confirm('This project is marked as settled. Add transaction anyway?')) {
                return;
            }
            // Reverse the settled flag when user confirms
            project.isSettled = false;
        }

        const expense = {
            id: Date.now(),
            type: 'expense',
            paidBy: document.getElementById('expensePaidBy').value,
            amount: parseFloat(document.getElementById('expenseAmount').value),
            description: document.getElementById('expenseDescription').value,
            date: document.getElementById('expenseDate').value
        };

        project.transactions.push(expense);
        await this.saveData();
        this.updateDisplay();
        
        // Reset form
        e.target.reset();
        document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    }

    async handleRevenueSubmit(e) {
        e.preventDefault();
        const project = this.getCurrentProject();
        if (!project) {
            alert('Please select a project first.');
            return;
        }
        if (project.isSettled) {
            if (!confirm('This project is marked as settled. Add transaction anyway?')) {
                return;
            }
            // Reverse the settled flag when user confirms
            project.isSettled = false;
        }

        const revenue = {
            id: Date.now() + 1,
            type: 'revenue',
            receivedBy: document.getElementById('revenueReceivedBy').value,
            amount: parseFloat(document.getElementById('revenueAmount').value),
            description: document.getElementById('revenueDescription').value,
            date: document.getElementById('revenueDate').value
        };

        project.transactions.push(revenue);
        await this.saveData();
        this.updateDisplay();
        
        // Reset form
        e.target.reset();
        document.getElementById('revenueDate').value = new Date().toISOString().split('T')[0];
    }

    calculateNetFlow(transactions, includeSettlements = true) {
        let partnerA = { revenue: 0, expenses: 0, settlementReceived: 0, settlementPaid: 0 };
        let partnerB = { revenue: 0, expenses: 0, settlementReceived: 0, settlementPaid: 0 };
        
        transactions.forEach(transaction => {
            if (transaction.type === 'expense') {
                if (transaction.paidBy === this.settings.partnerAName) {
                    partnerA.expenses += transaction.amount;
                } else if (transaction.paidBy === this.settings.partnerBName) {
                    partnerB.expenses += transaction.amount;
                }
            } else if (transaction.type === 'revenue') {
                if (transaction.receivedBy === this.settings.partnerAName) {
                    partnerA.revenue += transaction.amount;
                } else if (transaction.receivedBy === this.settings.partnerBName) {
                    partnerB.revenue += transaction.amount;
                }
            } else if (transaction.type === 'settlement' && includeSettlements) {
                if (transaction.paidBy === this.settings.partnerAName) {
                    partnerA.settlementPaid += transaction.amount;
                } else if (transaction.paidBy === this.settings.partnerBName) {
                    partnerB.settlementPaid += transaction.amount;
                }
                if (transaction.receivedBy === this.settings.partnerAName) {
                    partnerA.settlementReceived += transaction.amount;
                } else if (transaction.receivedBy === this.settings.partnerBName) {
                    partnerB.settlementReceived += transaction.amount;
                }
            }
        });
        
        const partnerANetFlow = partnerA.revenue + partnerA.settlementReceived - partnerA.expenses - partnerA.settlementPaid;
        const partnerBNetFlow = partnerB.revenue + partnerB.settlementReceived - partnerB.expenses - partnerB.settlementPaid;
        
        return { partnerA: partnerANetFlow, partnerB: partnerBNetFlow };
    }

    calculateBalances(transactions) {
        const partnerA = {
            expensesPaid: 0,
            revenueReceived: 0,
            expensesOwed: 0,
            revenueOwed: 0,
            settlementPaid: 0,
            settlementReceived: 0
        };

        const partnerB = {
            expensesPaid: 0,
            revenueReceived: 0,
            expensesOwed: 0,
            revenueOwed: 0,
            settlementPaid: 0,
            settlementReceived: 0
        };

        // Calculate contributions
        transactions.forEach(transaction => {
            if (transaction.type === 'expense') {
                if (transaction.paidBy === this.settings.partnerAName) {
                    partnerA.expensesPaid += transaction.amount;
                    partnerB.expensesOwed += transaction.amount / 2;
                } else if (transaction.paidBy === this.settings.partnerBName) {
                    partnerB.expensesPaid += transaction.amount;
                    partnerA.expensesOwed += transaction.amount / 2;
                }
            } else if (transaction.type === 'revenue') {
                if (transaction.receivedBy === this.settings.partnerAName) {
                    partnerA.revenueReceived += transaction.amount;
                    partnerB.revenueOwed += transaction.amount / 2;
                } else if (transaction.receivedBy === this.settings.partnerBName) {
                    partnerB.revenueReceived += transaction.amount;
                    partnerA.revenueOwed += transaction.amount / 2;
                }
            } else if (transaction.type === 'settlement') {
                // Settlement: track separately
                if (transaction.paidBy === this.settings.partnerAName) {
                    partnerA.settlementPaid += transaction.amount;
                } else if (transaction.paidBy === this.settings.partnerBName) {
                    partnerB.settlementPaid += transaction.amount;
                }
                if (transaction.receivedBy === this.settings.partnerAName) {
                    partnerA.settlementReceived += transaction.amount;
                } else if (transaction.receivedBy === this.settings.partnerBName) {
                    partnerB.settlementReceived += transaction.amount;
                }
            }
        });

        // Calculate net balances BEFORE settlement
        // Money owed to A = half of expenses A paid + half of revenue B received
        // Money A owes = half of expenses B paid + half of revenue A received
        const moneyAIsOwed = (partnerA.expensesPaid / 2) + (partnerB.revenueReceived / 2);
        const moneyAOwes = partnerA.expensesOwed + (partnerA.revenueReceived / 2);
        const baseNetBalanceA = moneyAIsOwed - moneyAOwes;
        
        const moneyBIsOwed = (partnerB.expensesPaid / 2) + (partnerA.revenueReceived / 2);
        const moneyBOwes = partnerB.expensesOwed + (partnerB.revenueReceived / 2);
        const baseNetBalanceB = moneyBIsOwed - moneyBOwes;
        
        // Apply settlements: settlement received increases your balance, settlement paid decreases it
        // But settlements are direct transfers, so they affect the balance 1:1
        const settlementA = (partnerA.settlementReceived || 0) - (partnerA.settlementPaid || 0);
        const settlementB = (partnerB.settlementReceived || 0) - (partnerB.settlementPaid || 0);
        
        partnerA.netBalance = baseNetBalanceA + settlementA;
        partnerB.netBalance = baseNetBalanceB + settlementB;

        return { partnerA, partnerB };
    }

    updateSummary() {
        const project = this.getCurrentProject();
        if (!project) {
            return;
        }

        const transactions = project.transactions;
        const expenses = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const revenue = transactions
            .filter(t => t.type === 'revenue')
            .reduce((sum, t) => sum + t.amount, 0);

        const netProfit = revenue - expenses;

        document.getElementById('totalExpenses').textContent = `$${expenses.toFixed(2)}`;
        document.getElementById('totalRevenue').textContent = `$${revenue.toFixed(2)}`;
        
        const netProfitEl = document.getElementById('netProfit');
        netProfitEl.textContent = `$${netProfit.toFixed(2)}`;
        netProfitEl.style.color = netProfit >= 0 ? '#27ae60' : '#e74c3c';

        // Update partner balances (moved to bottom)
        const balances = this.calculateBalances(transactions);
        
        // Calculate net flow for each partner (actual cash flow only)
        // Net flow = revenue received + settlement received - expenses paid - settlement paid
        // This represents actual money in/out, excluding "owed" amounts
        const partnerANetFlow = (balances.partnerA.revenueReceived || 0) + (balances.partnerA.settlementReceived || 0) - (balances.partnerA.expensesPaid || 0) - (balances.partnerA.settlementPaid || 0);
        const partnerBNetFlow = (balances.partnerB.revenueReceived || 0) + (balances.partnerB.settlementReceived || 0) - (balances.partnerB.expensesPaid || 0) - (balances.partnerB.settlementPaid || 0);
        
        const balanceHTML = `
            <div class="balance-card partner-a">
                <h4>${this.settings.partnerAName}</h4>
                <div class="balance-detail">Expenses Paid: <span class="negative-amount">-$${balances.partnerA.expensesPaid.toFixed(2)}</span></div>
                <div class="balance-detail">Revenue Received: <span class="positive-amount">+$${balances.partnerA.revenueReceived.toFixed(2)}</span></div>
                ${(balances.partnerA.settlementPaid || 0) > 0 ? `<div class="balance-detail">Settlement Paid: <span class="negative-amount">-$${(balances.partnerA.settlementPaid || 0).toFixed(2)}</span></div>` : ''}
                ${(balances.partnerA.settlementReceived || 0) > 0 ? `<div class="balance-detail">Settlement Received: <span class="positive-amount">+$${(balances.partnerA.settlementReceived || 0).toFixed(2)}</span></div>` : ''}
                <div class="balance-owed ${partnerANetFlow >= 0 ? 'positive' : 'negative'}">
                    Net Flow: <span class="${partnerANetFlow >= 0 ? 'positive-amount' : 'negative-amount'}">${partnerANetFlow >= 0 ? '+' : ''}$${(partnerANetFlow || 0).toFixed(2)}</span>
                </div>
            </div>
            <div class="balance-card partner-b">
                <h4>${this.settings.partnerBName}</h4>
                <div class="balance-detail">Expenses Paid: <span class="negative-amount">-$${balances.partnerB.expensesPaid.toFixed(2)}</span></div>
                <div class="balance-detail">Revenue Received: <span class="positive-amount">+$${balances.partnerB.revenueReceived.toFixed(2)}</span></div>
                ${(balances.partnerB.settlementPaid || 0) > 0 ? `<div class="balance-detail">Settlement Paid: <span class="negative-amount">-$${(balances.partnerB.settlementPaid || 0).toFixed(2)}</span></div>` : ''}
                ${(balances.partnerB.settlementReceived || 0) > 0 ? `<div class="balance-detail">Settlement Received: <span class="positive-amount">+$${(balances.partnerB.settlementReceived || 0).toFixed(2)}</span></div>` : ''}
                <div class="balance-owed ${partnerBNetFlow >= 0 ? 'positive' : 'negative'}">
                    Net Flow: <span class="${partnerBNetFlow >= 0 ? 'positive-amount' : 'negative-amount'}">${partnerBNetFlow >= 0 ? '+' : ''}$${partnerBNetFlow.toFixed(2)}</span>
                </div>
            </div>
        `;
        const balanceSection = document.getElementById('balanceSection');
        const partnerBalances = document.getElementById('partnerBalances');
        if (partnerBalances) {
            partnerBalances.innerHTML = balanceHTML;
        }
        if (balanceSection) {
            balanceSection.style.display = 'block';
        }

        // Update project name and settlement status
        document.getElementById('projectName').textContent = project.name;
        const markSettledBtn = document.getElementById('markSettledBtn');
        const summaryActions = document.getElementById('summaryActions');
        
        // Check actual balance state using net flows
        const netFlows = this.calculateNetFlow(transactions, true);
        const netFlowDifference = Math.abs(netFlows.partnerA - netFlows.partnerB);
        const isActuallySettled = netFlowDifference < 0.01;
        
        // Update button based on actual state (but keep project.isSettled flag for user preference)
        if (isActuallySettled) {
            markSettledBtn.textContent = 'Mark as Unsettled';
            markSettledBtn.classList.add('settled');
        } else {
            markSettledBtn.textContent = 'Mark as Settled';
            markSettledBtn.classList.remove('settled');
        }
        if (summaryActions) summaryActions.style.display = 'flex';

        // Add settlement message
        this.addSettlementMessage(balances);
    }

    addSettlementMessage(balances) {
        const settlementContainer = document.getElementById('settlementMessageContainer');
        if (!settlementContainer) return;
        
        settlementContainer.innerHTML = '';

        const project = this.getCurrentProject();
        if (!project) return;

        // Calculate net flows for both partners (including all settlements)
        const netFlows = this.calculateNetFlow(project.transactions, true);
        const partnerANetFlow = netFlows.partnerA;
        const partnerBNetFlow = netFlows.partnerB;
        
        // Check if net flows are equal (within 0.01 tolerance)
        const netFlowDifference = Math.abs(partnerANetFlow - partnerBNetFlow);
        
        // Calculate settlement amount needed
        const settlementAmount = netFlowDifference / 2;
        
        // Always show settlement message (either settled or needs settlement)
        const message = document.createElement('div');
        message.className = 'settlement-message';
        
        if (netFlowDifference < 0.01) {
            // Accounts are truly balanced
            message.style.cssText = 'margin-top: 15px; padding: 15px; background: #d4edda; border-radius: 8px; border-left: 4px solid #28a745;';
            message.innerHTML = `
                <strong>Settlement:</strong> Project has been settled. No payment needed.
            `;
        } else {
            // Settlement needed
            message.style.cssText = 'margin-top: 15px; padding: 15px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;';
            
            // Partner with higher net flow pays the partner with lower net flow
            if (partnerANetFlow > partnerBNetFlow) {
                message.innerHTML = `
                    <strong>Settlement:</strong> ${this.settings.partnerAName} should pay ${this.settings.partnerBName} <strong>$${settlementAmount.toFixed(2)}</strong> to balance accounts.
                `;
            } else {
                message.innerHTML = `
                    <strong>Settlement:</strong> ${this.settings.partnerBName} should pay ${this.settings.partnerAName} <strong>$${settlementAmount.toFixed(2)}</strong> to balance accounts.
                `;
            }
        }
        
        settlementContainer.appendChild(message);
    }

    renderTransactions() {
        const transactionsList = document.getElementById('transactionsList');
        const project = this.getCurrentProject();
        
        if (!project) {
            transactionsList.innerHTML = '<div class="empty-state"><p>Select a project to view transactions.</p></div>';
            return;
        }

        let filteredTransactions = project.transactions;
        if (this.currentTab === 'expenses') {
            filteredTransactions = project.transactions.filter(t => t.type === 'expense');
        } else if (this.currentTab === 'revenue') {
            filteredTransactions = project.transactions.filter(t => t.type === 'revenue');
        }

        filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (filteredTransactions.length === 0) {
            transactionsList.innerHTML = '<div class="empty-state"><p>No transactions yet. Add an expense or revenue to get started!</p></div>';
            return;
        }

        transactionsList.innerHTML = filteredTransactions.map(transaction => {
            const date = new Date(transaction.date).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });

            if (transaction.type === 'expense') {
                return `
                    <div class="transaction-item expense">
                        <div class="transaction-info">
                            <div style="font-weight: 600; margin-bottom: 5px;">${transaction.description}</div>
                            <div class="transaction-details">
                                Paid by ${transaction.paidBy} on ${date}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center;">
                            <span class="transaction-amount">-$${transaction.amount.toFixed(2)}</span>
                            <button class="delete-btn" onclick="calculator.deleteTransaction(${transaction.id})">Delete</button>
                        </div>
                    </div>
                `;
            } else if (transaction.type === 'settlement') {
                // Show settlement as two separate lines - one for payer, one for receiver
                const currentPartner = this.settings.partnerAName; // We'll check which partner this is for
                const isPayer = transaction.paidBy === this.settings.partnerAName || transaction.paidBy === this.settings.partnerBName;
                const isReceiver = transaction.receivedBy === this.settings.partnerAName || transaction.receivedBy === this.settings.partnerBName;
                
                // Show both lines for settlement
                return `
                    <div class="transaction-item settlement">
                        <div class="transaction-info">
                            <div style="font-weight: 600; margin-bottom: 5px;">Settlement</div>
                            <div class="transaction-details" style="display: flex; flex-direction: column; gap: 5px;">
                                <div>Settlement paid by ${transaction.paidBy} on ${date}</div>
                                <div>Settlement received by ${transaction.receivedBy} on ${date}</div>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
                            <span class="transaction-amount" style="color: #e74c3c;">-$${transaction.amount.toFixed(2)}</span>
                            <span class="transaction-amount" style="color: #27ae60;">+$${transaction.amount.toFixed(2)}</span>
                            <button class="delete-btn" onclick="calculator.deleteTransaction(${transaction.id})">Delete</button>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="transaction-item revenue">
                        <div class="transaction-info">
                            <div style="font-weight: 600; margin-bottom: 5px;">${transaction.description}</div>
                            <div class="transaction-details">
                                Received by ${transaction.receivedBy} on ${date}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center;">
                            <span class="transaction-amount">+$${transaction.amount.toFixed(2)}</span>
                            <button class="delete-btn" onclick="calculator.deleteTransaction(${transaction.id})">Delete</button>
                        </div>
                    </div>
                `;
            }
        }).join('');
    }

    switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        this.renderTransactions();
    }

    async deleteTransaction(id) {
        const project = this.getCurrentProject();
        if (!project) return;
        
        if (confirm('Are you sure you want to delete this transaction?')) {
            project.transactions = project.transactions.filter(t => t.id !== id);
            await this.saveData();
            this.updateDisplay();
        }
    }

    async clearProjectData() {
        const project = this.getCurrentProject();
        if (!project) return;
        
        if (confirm('Are you sure you want to delete ALL transactions for this project? This cannot be undone.')) {
            project.transactions = [];
            await this.saveData();
            this.updateDisplay();
        }
    }

    renderProjectList() {
        const projectSelector = document.getElementById('projectSelector');
        if (!projectSelector) return;
        
        // Clear existing options except the first one
        projectSelector.innerHTML = '<option value="">Select a project...</option>';
        
        if (this.projects.length === 0) {
            return;
        }

        // Sort by creation date (newest first)
        const sortedProjects = [...this.projects].sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));

        sortedProjects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name + (project.isSettled ? ' ✓' : '');
            if (project.id === this.currentProjectId) {
                option.selected = true;
            }
            projectSelector.appendChild(option);
        });
    }

    selectProject(projectId) {
        this.currentProjectId = projectId;
        this.saveData();
        this.renderProjectList();
        this.updateDisplay();
        document.getElementById('projectSummary').style.display = 'block';
        document.getElementById('noProjectMessage').style.display = 'none';
        document.getElementById('clearProjectBtn').style.display = 'block';
    }

    showNoProjectState() {
        document.getElementById('projectSummary').style.display = 'none';
        document.getElementById('noProjectMessage').style.display = 'block';
        const summaryActions = document.getElementById('summaryActions');
        if (summaryActions) summaryActions.style.display = 'none';
        document.getElementById('clearProjectBtn').style.display = 'none';
        document.getElementById('projectName').textContent = 'Select a Project';
        document.getElementById('transactionsList').innerHTML = '<div class="empty-state"><p>Select a project to view transactions.</p></div>';
        const balanceSection = document.getElementById('balanceSection');
        if (balanceSection) balanceSection.style.display = 'none';
    }

    async createProject() {
        const nameInput = document.getElementById('newProjectName');
        const name = nameInput.value.trim();
        
        if (!name) {
            alert('Please enter a project name.');
            return;
        }

        const newProject = {
            id: Date.now(),
            name: name,
            createdDate: new Date().toISOString().split('T')[0],
            isSettled: false,
            transactions: []
        };

        this.projects.push(newProject);
        await this.saveData();
        this.renderProjectList();
        this.selectProject(newProject.id);
        this.hideNewProjectModal();
        nameInput.value = '';
    }

    async deleteProject(projectId) {
        if (confirm('Are you sure you want to delete this project? All transactions will be lost.')) {
            this.projects = this.projects.filter(p => p.id !== projectId);
            if (this.currentProjectId === projectId) {
                this.currentProjectId = null;
                this.showNoProjectState();
            }
            await this.saveData();
            this.renderProjectList();
        }
    }

    async toggleSettlement() {
        const project = this.getCurrentProject();
        if (!project) return;
        
        // If marking as settled (not already settled), add settlement transaction
        if (!project.isSettled) {
            // Calculate net flows excluding existing settlement transactions
            const nonSettlementTransactions = project.transactions.filter(t => t.type !== 'settlement');
            const netFlows = this.calculateNetFlow(nonSettlementTransactions, false);
            const partnerANetFlow = netFlows.partnerA;
            const partnerBNetFlow = netFlows.partnerB;
            
            const netFlowDifference = Math.abs(partnerANetFlow - partnerBNetFlow);
            const settlementAmount = netFlowDifference / 2;
            
            if (settlementAmount > 0.01) {
                // Determine who pays whom - partner with higher net flow pays partner with lower net flow
                let payer, receiver, description;
                if (partnerANetFlow > partnerBNetFlow) {
                    payer = this.settings.partnerAName;
                    receiver = this.settings.partnerBName;
                } else {
                    payer = this.settings.partnerBName;
                    receiver = this.settings.partnerAName;
                }
                
                description = `Settlement payment from ${payer} to ${receiver}`;
                
                // Add as a settlement transaction
                const settlementTransaction = {
                    id: Date.now(),
                    type: 'settlement',
                    paidBy: payer,
                    receivedBy: receiver,
                    amount: settlementAmount,
                    description: description,
                    date: new Date().toISOString().split('T')[0]
                };
                
                project.transactions.push(settlementTransaction);
            }
        }
        
        project.isSettled = !project.isSettled;
        await this.saveData();
        this.renderProjectList();
        this.updateDisplay();
    }

    showNewProjectModal() {
        document.getElementById('newProjectModal').style.display = 'block';
        document.getElementById('newProjectName').focus();
    }

    hideNewProjectModal() {
        document.getElementById('newProjectModal').style.display = 'none';
        document.getElementById('newProjectName').value = '';
    }

    editProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;
        
        document.getElementById('editProjectName').value = project.name;
        document.getElementById('editProjectModal').dataset.projectId = projectId;
        document.getElementById('editProjectModal').style.display = 'block';
        document.getElementById('editProjectName').focus();
    }

    async saveProjectEdit() {
        const projectId = parseInt(document.getElementById('editProjectModal').dataset.projectId);
        const nameInput = document.getElementById('editProjectName');
        const name = nameInput.value.trim();
        
        if (!name) {
            alert('Please enter a project name.');
            return;
        }

        const project = this.projects.find(p => p.id === projectId);
        if (project) {
            project.name = name;
            await this.saveData();
            this.renderProjectList();
            this.updateDisplay();
            this.hideEditProjectModal();
        }
    }

    deleteProjectFromModal() {
        const projectId = parseInt(document.getElementById('editProjectModal').dataset.projectId);
        this.hideEditProjectModal();
        this.deleteProject(projectId);
    }

    hideEditProjectModal() {
        document.getElementById('editProjectModal').style.display = 'none';
        document.getElementById('editProjectName').value = '';
        delete document.getElementById('editProjectModal').dataset.projectId;
    }

    showSettingsModal() {
        const modal = document.getElementById('settingsModal');
        const partnerAInput = document.getElementById('partnerAName');
        const partnerBInput = document.getElementById('partnerBName');
        if (modal) {
            if (partnerAInput) partnerAInput.value = this.settings.partnerAName;
            if (partnerBInput) partnerBInput.value = this.settings.partnerBName;
            modal.style.display = 'block';
        }
    }

    hideSettingsModal() {
        document.getElementById('settingsModal').style.display = 'none';
    }

    async saveSettings() {
        const partnerAName = document.getElementById('partnerAName').value.trim();
        const partnerBName = document.getElementById('partnerBName').value.trim();
        
        if (!partnerAName || !partnerBName) {
            alert('Please enter names for both partners.');
            return;
        }

        const oldPartnerAName = this.settings.partnerAName;
        const oldPartnerBName = this.settings.partnerBName;

        this.settings.partnerAName = partnerAName;
        this.settings.partnerBName = partnerBName;

        // Update all transactions with new partner names
        this.projects.forEach(project => {
            project.transactions.forEach(transaction => {
                if (transaction.type === 'expense') {
                    if (transaction.paidBy === oldPartnerAName) {
                        transaction.paidBy = partnerAName;
                    } else if (transaction.paidBy === oldPartnerBName) {
                        transaction.paidBy = partnerBName;
                    }
                } else if (transaction.type === 'revenue') {
                    if (transaction.receivedBy === oldPartnerAName) {
                        transaction.receivedBy = partnerAName;
                    } else if (transaction.receivedBy === oldPartnerBName) {
                        transaction.receivedBy = partnerBName;
                    }
                }
            });
        });

        await this.saveData();
        this.updatePartnerNamesInForms();
        this.hideSettingsModal();
        this.updateDisplay();
    }

    updateDisplay() {
        if (this.currentProjectId) {
            this.updateSummary();
            this.renderTransactions();
        } else {
            this.showNoProjectState();
        }
    }

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            this.workspaceAuth.logout();
            window.location.href = 'login.html';
        }
    }
}

// Initialize the calculator when the page loads
let calculator;
document.addEventListener('DOMContentLoaded', () => {
    calculator = new BusinessCalculator();
});
