document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const balanceEl = document.getElementById('balance');
    const incomeEl = document.getElementById('total-income');
    const expenseEl = document.getElementById('total-expense');
    const listEl = document.getElementById('transaction-list');
    const form = document.getElementById('transaction-form');
    const textInput = document.getElementById('text');
    const amountInput = document.getElementById('amount');
    const dateInput = document.getElementById('date');
    const categoryInput = document.getElementById('category');
    const typeInput = document.getElementById('type-select');
    const monthFilter = document.getElementById('month-filter');
    
    // Edit & Buttons
    const submitBtn = document.getElementById('submit-btn');
    const cancelBtn = document.getElementById('cancel-edit');
    const editIdInput = document.getElementById('edit-id');
    const exportBtn = document.getElementById('export-btn');
    const resetBtn = document.getElementById('reset-btn');

    // Saving Goal Elements (BARU)
    const goalInput = document.getElementById('saving-goal');
    const setGoalBtn = document.getElementById('set-goal-btn');
    const displayTargetEl = document.getElementById('display-target');
    const displayActualEl = document.getElementById('display-actual');
    const displayDeficitEl = document.getElementById('display-deficit');
    const progressBar = document.getElementById('saving-progress-bar');
    const progressPercent = document.getElementById('saving-progress-percent');

    // Chart Contexts
    const ctxExpense = document.getElementById('expenseChart') ? document.getElementById('expenseChart').getContext('2d') : null;
    const ctxTrend = document.getElementById('trendChart') ? document.getElementById('trendChart').getContext('2d') : null;

    // --- STATE & VARIABLES ---
    let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
    let expenseChartInstance = null;
    let trendChartInstance = null;
    
    // Simpan target tabungan per bulan (BARU)
    let savingGoals = JSON.parse(localStorage.getItem('savingGoals')) || {}; 

    // Daftar Kategori
    const categories = {
        expense: ['Makanan', 'Transportasi', 'Tagihan', 'Hiburan', 'Belanja', 'Kesehatan', 'Pendidikan', 'Sedekah', 'Lainnya'],
        income: ['Gaji', 'Bonus', 'Freelance', 'Investasi', 'Hadiah', 'Lainnya'],
        saving: ['Target Tabungan', 'Dana Darurat', 'Investasi'] // Kategori untuk tipe 'saving'
    };

    // --- INIT ---
    function init() {
        dateInput.valueAsDate = new Date();
        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        monthFilter.value = currentMonthStr;

        updateCategories(); 
        updateUI();
    }

    // --- HELPER FUNCTIONS ---

    function formatRupiah(number) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(number);
    }
    
    function updateLocalStorage() {
        localStorage.setItem('transactions', JSON.stringify(transactions));
        localStorage.setItem('savingGoals', JSON.stringify(savingGoals)); // Simpan Goal BARU
    }

    function updateCategories() {
        const type = typeInput.value;
        categoryInput.innerHTML = '';
        categories[type].forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.innerText = cat;
            categoryInput.appendChild(option);
        });
    }

    // Amount formatting listener
    amountInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    });

    goalInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    });
    
    typeInput.addEventListener('change', updateCategories);

    // --- CORE LOGIC: FILTERING ---
    function getCurrentMonthKey() {
        return monthFilter.value;
    }

    function getFilteredTransactions() {
        const selectedMonth = getCurrentMonthKey();
        if (!selectedMonth) return transactions;
        return transactions.filter(t => t.date.startsWith(selectedMonth));
    }

    // --- SAVING GOAL LOGIC (BARU) ---

    setGoalBtn.addEventListener('click', () => {
        const rawAmount = goalInput.value.replace(/\./g, '');
        const goalAmount = parseInt(rawAmount);
        const currentMonth = getCurrentMonthKey();

        if (isNaN(goalAmount) || goalAmount < 0) {
            alert('Target harus berupa angka positif.');
            return;
        }

        savingGoals[currentMonth] = goalAmount;
        updateLocalStorage();
        updateSavingGoalUI();
        alert(`Target tabungan bulan ${currentMonth} berhasil diatur menjadi ${formatRupiah(goalAmount)}!`);
    });

    function updateSavingGoalUI() {
        const currentMonth = getCurrentMonthKey();
        const targetGoal = savingGoals[currentMonth] || 0;
        
        // Filter transaksi TIPE 'saving' untuk bulan ini
        const savingTransactions = getFilteredTransactions().filter(t => t.type === 'saving');
        const actualSavings = savingTransactions.reduce((sum, t) => sum + t.amount, 0);

        const deficit = Math.max(0, targetGoal - actualSavings);
        const percentage = targetGoal > 0 ? (actualSavings / targetGoal) * 100 : 0;
        const displayPercentage = Math.min(100, percentage).toFixed(0);

        // Update display data
        displayTargetEl.innerText = formatRupiah(targetGoal);
        displayActualEl.innerText = formatRupiah(actualSavings);
        displayDeficitEl.innerText = formatRupiah(deficit);

        // Update warna Kekurangan
        displayDeficitEl.classList.remove('deficit-text', 'income-text');
        if (deficit > 0) {
            displayDeficitEl.classList.add('deficit-text'); // Merah
        } else {
            // Jika tidak ada kekurangan (target tercapai atau tidak ada target)
            displayDeficitEl.innerText = targetGoal > 0 ? "Target Tercapai!" : "Rp 0";
            displayDeficitEl.classList.add('income-text'); // Hijau jika tercapai
        }


        // Update progress bar
        progressBar.style.width = `${displayPercentage}%`;
        progressPercent.innerText = `${displayPercentage}%`;

        // Update input field
        goalInput.value = targetGoal > 0 ? targetGoal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
    }

    // --- CRUD OPERATIONS ---
    form.addEventListener('submit', saveTransaction);

    function saveTransaction(e) {
        e.preventDefault();
        // ... (Logika validasi dan parsing sama) ...
        const text = textInput.value.trim();
        const rawAmount = amountInput.value.replace(/\./g, ''); 
        const date = dateInput.value;

        if (text === '' || rawAmount === '' || date === '') {
            alert('Mohon lengkapi semua data');
            return;
        }
        
        const amount = parseInt(rawAmount);
        if (isNaN(amount) || amount <= 0) {
            alert('Jumlah transaksi harus berupa angka positif.');
            return;
        }

        const type = typeInput.value;
        const category = categoryInput.value;
        const editId = editIdInput.value;

        if (editId) {
            const index = transactions.findIndex(t => t.id == editId);
            if (index !== -1) {
                transactions[index] = { id: parseInt(editId), text, amount, type, category, date }; 
            }
            exitEditMode();
        } else {
            const transaction = {
                id: Date.now(),
                text, amount, type, category, date
            };
            transactions.push(transaction);
        }

        updateLocalStorage();
        updateUI();
        
        textInput.value = '';
        amountInput.value = '';
        // Tetap di tipe terakhir, jangan di-reset
        // dateInput.valueAsDate = new Date(); 
    }
    
    window.removeTransaction = function(id) {
        if(confirm('Hapus transaksi ini?')) {
            transactions = transactions.filter(t => t.id !== id);
            updateLocalStorage();
            updateUI();
        }
    }
    
    window.editTransaction = function(id) {
        const t = transactions.find(t => t.id === id);
        if (!t) return;

        textInput.value = t.text;
        amountInput.value = t.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."); 
        typeInput.value = t.type;
        dateInput.value = t.date;
        updateCategories(); // Panggil agar kategori baru terisi
        categoryInput.value = t.category;
        editIdInput.value = t.id;

        submitBtn.innerText = 'Update';
        submitBtn.style.background = '#e67e22';
        cancelBtn.style.display = 'block';
        
        if(window.innerWidth < 768) {
            document.querySelector('.form-section').scrollIntoView({behavior: 'smooth'});
        }
    }

    function exitEditMode() {
        editIdInput.value = '';
        submitBtn.innerText = 'Simpan';
        submitBtn.style.background = '';
        cancelBtn.style.display = 'none';
        textInput.value = '';
        amountInput.value = '';
        dateInput.valueAsDate = new Date();
        updateCategories();
    }

    cancelBtn.addEventListener('click', exitEditMode);
    monthFilter.addEventListener('change', updateUI);

    // --- UI UPDATE MANAGER ---
    function updateUI() {
        const filteredData = getFilteredTransactions();
        
        // Hanya hitung Income & Expense, abaikan Saving dari Summary
        const summaryAmounts = filteredData.filter(t => t.type !== 'saving').map(t => t.type === 'income' ? t.amount : -t.amount);
        
        const total = summaryAmounts.reduce((acc, item) => (acc += item), 0);
        const income = summaryAmounts.filter(item => item > 0).reduce((acc, item) => (acc += item), 0);
        const expense = summaryAmounts.filter(item => item < 0).reduce((acc, item) => (acc += item), 0) * -1;

        balanceEl.innerText = formatRupiah(total);
        incomeEl.innerText = formatRupiah(income);
        expenseEl.innerText = formatRupiah(expense);
        
        // Tambahkan kelas untuk saldo negatif
        balanceEl.classList.toggle('negative', total < 0);

        listEl.innerHTML = '';
        const sortedData = [...filteredData].sort((a, b) => new Date(b.date) - new Date(a.date)); 
        
        if (sortedData.length === 0) {
            listEl.innerHTML = '<p style="text-align:center; color:#999; margin-top:20px;">Tidak ada data di bulan ini.</p>';
        }

        sortedData.forEach(t => {
            const item = document.createElement('li');
            item.classList.add(t.type);
            const sign = t.type === 'income' ? '+' : (t.type === 'expense' ? '-' : ' '); // Saving tidak ada tanda +/- di list
            const dateFormatted = new Date(t.date + 'T00:00:00').toLocaleDateString('id-ID', {day:'numeric', month:'short'}); 
            
            // Tentukan style untuk Saving (optional, bisa diatur di CSS)
            const amountStyle = t.type === 'saving' ? `color: var(--saving-color);` : '';

            item.innerHTML = `
                <div>
                    <h4>${t.text} <span class="history-date">${dateFormatted}</span></h4>
                    <small>${t.category}</small>
                </div>
                <div style="text-align:right;">
                    <span style="font-weight:bold; display:block; ${amountStyle}">${sign} ${formatRupiah(t.amount)}</span>
                    <div style="margin-top:5px;">
                        <button class="action-btn edit-btn" onclick="editTransaction(${t.id})"><i class="fa-solid fa-pen"></i></button>
                        <button class="action-btn delete-btn" style="color:#ff7675; margin-left:5px;" onclick="removeTransaction(${t.id})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
            listEl.appendChild(item);
        });

        // Panggil update UI Saving Goal
        updateSavingGoalUI();

        generateAIInsight(income, expense, filteredData.filter(t => t.type !== 'saving')); // Data AI tanpa Saving
        renderCharts(filteredData.filter(t => t.type === 'expense')); // Chart hanya butuh data expense
    }

    // --- LOGIKA AI CERDAS (SEDERHANA) ---
    function generateAIInsight(inc, exp, transactions) {
        const iconEl = document.getElementById('persona-icon');
        const descEl = document.getElementById('persona-desc');
        if (!iconEl || !descEl) return;
        
        let categoryTotals = {};
        transactions.forEach(t => {
            if(t.type === 'expense') {
                categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
            }
        });

        let insights = [];

        // A. Logika Kondisi Kritis
        if (inc === 0 && exp === 0) {
            setAI('😴', 'Data masih kosong nih. Yuk catat transaksi pertamamu!'); return;
        }
        if (exp > inc) {
            setAI('🚨', 'Waspada! Pengeluaranmu lebih besar dari pemasukan (Besar Pasak daripada Tiang). Rem belanjaan!'); return;
        }
        
        // B. Logika Kategori Spesifik
        if (exp > 0) {
            const totalMakanan = categoryTotals['Makanan'] || 0;
            if (totalMakanan > 0 && (totalMakanan / exp) > 0.4) {
                insights.push({ icon: '🍔', text: "Waduh, 40% uangmu habis di perut! Coba masak sendiri yuk, lebih hemat." });
            }

            if (((categoryTotals['Hiburan'] || 0) + (categoryTotals['Belanja'] || 0)) > (exp * 0.3)) {
                insights.push({ icon: '🛍️', text: "Self-reward itu perlu, tapi jangan sampai boncos ya! Tahan belanja online." });
            }
        } 

        // C. Logika Positif
        if (categoryTotals['Sedekah'] && categoryTotals['Sedekah'] > 0) {
            insights.push({ icon: '🤲', text: "Harta tidak akan berkurang karena sedekah. Keren!" });
        }
        if (inc > 0 && exp < inc) {
            if ((inc - exp) / inc > 0.5) {
                insights.push({ icon: '👑', text: "Luar biasa! Kamu berhasil menabung lebih dari 50% pendapatanmu." });
            } else if (insights.length === 0) { 
                insights.push({ icon: '✅', text: "Keuanganmu cukup stabil. Pertahankan dan jangan lupa menabung." });
            }
        }
        
        // D. PEMILIHAN SARAN
        const selected = insights.length > 0 ? insights[0] : { icon: '🤔', text: 'Terus catat keuanganmu agar insight AI makin akurat!'};
        setAI(selected.icon, selected.text);
    }

    function setAI(icon, text) {
        document.getElementById('persona-icon').innerText = icon;
        document.getElementById('persona-desc').innerText = text;
    }

    // --- CHART.JS IMPLEMENTATION ---
    function renderCharts(expenseData) {
        if (!ctxExpense || !ctxTrend) return;
        
        // 1. Chart Pengeluaran per Kategori (Doughnut)
        const expenseCats = {};
        expenseData.forEach(t => {
            expenseCats[t.category] = (expenseCats[t.category] || 0) + t.amount;
        });
        
        if (expenseChartInstance) expenseChartInstance.destroy();
        expenseChartInstance = new Chart(ctxExpense, {
            type: 'doughnut',
            data: {
                labels: Object.keys(expenseCats),
                datasets: [{
                    data: Object.values(expenseCats),
                    backgroundColor: [
                        '#ff7675', '#74b9ff', '#55efc4', '#a29bfe', '#ffeaa7',
                        '#fd79a8', '#00b894', '#6c5ce7', '#dfe6e9'
                    ],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    title: {
                        display: false
                    }
                }
            }
        });

        // 2. Chart Arus Kas Bulanan (Line/Bar)
        // Data Arus Kas (Income - Expense) per Hari
        const dataForTrend = getFilteredTransactions().filter(t => t.type !== 'saving'); // Tanpa Saving
        const daysInMonth = {};
        dataForTrend.forEach(t => {
            const day = parseInt(t.date.split('-')[2]);
            if (!daysInMonth[day]) daysInMonth[day] = 0;
            if (t.type === 'income') daysInMonth[day] += t.amount;
            else daysInMonth[day] -= t.amount;
        });
            
        const labels = Object.keys(daysInMonth).sort((a,b) => parseInt(a)-parseInt(b));
        const cumulativeData = [];
        let runningBalance = 0;

        labels.forEach(day => {
            runningBalance += daysInMonth[day];
            cumulativeData.push(runningBalance);
        });

        if (trendChartInstance) trendChartInstance.destroy();
        trendChartInstance = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Arus Kas Kumulatif',
                    data: cumulativeData,
                    backgroundColor: 'rgba(108, 92, 231, 0.2)',
                    borderColor: 'var(--primary-color)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(value) {
                                return formatRupiah(value);
                            }
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Tanggal Bulan Ini'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += formatRupiah(context.parsed.y);
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    // --- INITIALIZE APP ---
    form.addEventListener('submit', saveTransaction);
    monthFilter.addEventListener('change', updateUI);
    // Tambahkan listener untuk Goal Input agar bisa diformat

    // Reset All Data
    resetBtn.addEventListener('click', () => {
        if(confirm('Apakah Anda yakin ingin menghapus SEMUA data transaksi dan target tabungan? Aksi ini tidak dapat dibatalkan.')) {
            localStorage.removeItem('transactions');
            localStorage.removeItem('savingGoals');
            transactions = [];
            savingGoals = {};
            init();
        }
    });

    init();
});
