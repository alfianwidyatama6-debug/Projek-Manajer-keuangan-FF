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

    // Saving Goal Elements
    const goalInput = document.getElementById('saving-goal');
    const setGoalBtn = document.getElementById('set-goal-btn');
    const displayTargetEl = document.getElementById('display-target');
    const displayActualEl = document.getElementById('display-actual');
    const displayDeficitEl = document.getElementById('display-deficit');
    const progressBar = document.getElementById('saving-progress-bar');
    const progressPercent = document.getElementById('saving-progress-percent');
    
    // AI Comment Element
    const personaDescEl = document.getElementById('persona-desc');

    // Chart Contexts
    const ctxExpense = document.getElementById('expenseChart') ? document.getElementById('expenseChart').getContext('2d') : null;
    const ctxTrend = document.getElementById('trendChart') ? document.getElementById('trendChart').getContext('2d') : null;

    // --- STATE & VARIABLES ---
    let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
    let savingGoals = JSON.parse(localStorage.getItem('savingGoals')) || {}; // Target Tabungan
    let expenseChartInstance = null;
    let trendChartInstance = null;
    
    // Daftar Kategori
    const categories = {
        expense: ['Makanan', 'Transportasi', 'Tagihan', 'Hiburan', 'Belanja', 'Kesehatan', 'Pendidikan', 'Sedekah', 'Lainnya'],
        income: ['Gaji', 'Bonus', 'Freelance', 'Investasi', 'Hadiah', 'Lainnya'],
        saving: ['Target Tabungan', 'Dana Darurat', 'Investasi']
    };

    // --- INIT ---
    function init() {
        // Set tanggal input default ke hari ini
        dateInput.valueAsDate = new Date();
        
        // Set filter bulan default ke bulan ini
        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        monthFilter.value = currentMonthStr;

        updateCategories();
        updateUI();
    }

    // --- HELPER FUNCTIONS ---

    function formatRupiah(number) {
        // Fungsi ini menggunakan Math.abs agar logika penentuan tanda (-) dilakukan di fungsi lain (updateValues)
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(Math.abs(number)); 
    }
    
    function updateLocalStorage() {
        localStorage.setItem('transactions', JSON.stringify(transactions));
        localStorage.setItem('savingGoals', JSON.stringify(savingGoals));
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

    // Amount formatting listener (Mengatur titik ribuan saat mengetik)
    function formatInput(e) {
        let value = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
    
    amountInput.addEventListener('input', formatInput);
    goalInput.addEventListener('input', formatInput);
    typeInput.addEventListener('change', updateCategories);
    monthFilter.addEventListener('change', updateUI); 

    // --- CORE LOGIC: FILTERING ---
    function getCurrentMonthKey() {
        return monthFilter.value;
    }

    function getFilteredTransactions() {
        const selectedMonth = getCurrentMonthKey();
        if (!selectedMonth) return transactions;
        return transactions.filter(t => t.date.startsWith(selectedMonth));
    }
    
    // --- SAVING GOAL LOGIC ---

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
        
        const savingTransactions = getFilteredTransactions().filter(t => t.type === 'saving');
        const actualSavings = savingTransactions.reduce((sum, t) => sum + t.amount, 0);

        const deficit = Math.max(0, targetGoal - actualSavings);
        const percentage = targetGoal > 0 ? (actualSavings / targetGoal) * 100 : 0;
        const displayPercentage = Math.min(100, percentage).toFixed(0);

        displayTargetEl.innerText = formatRupiah(targetGoal);
        displayActualEl.innerText = formatRupiah(actualSavings);
        
        displayDeficitEl.classList.remove('deficit-text', 'income-text');
        if (deficit > 0) {
            displayDeficitEl.innerText = formatRupiah(deficit);
            displayDeficitEl.classList.add('deficit-text'); 
        } else {
            displayDeficitEl.innerText = targetGoal > 0 ? "Target Tercapai!" : "Rp 0";
            if (targetGoal > 0 || actualSavings > 0) {
                displayDeficitEl.classList.add('income-text');
            }
        }

        progressBar.style.width = `${displayPercentage}%`;
        progressPercent.innerText = `${displayPercentage}%`;

        goalInput.value = targetGoal > 0 ? targetGoal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
    }

    // --- CRUD OPERATIONS ---
    form.addEventListener('submit', saveTransaction);
    cancelBtn.addEventListener('click', exitEditMode);

    function saveTransaction(e) {
        e.preventDefault();
        
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
        updateCategories();
        categoryInput.value = t.category;
        editIdInput.value = t.id;

        submitBtn.innerText = 'Update';
        submitBtn.style.background = 'linear-gradient(135deg, #e67e22 0%, #f1c40f 100%)'; 
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
        typeInput.value = 'expense';
        updateCategories();
    }
    
    // --- DISPLAY / RENDER UI ---

    function addTransactionDOM(transaction) {
        const item = document.createElement('li');
        item.classList.add(transaction.type);

        const rupiahAmount = formatRupiah(transaction.amount);
        let displayAmount;

        if (transaction.type === 'income') {
            displayAmount = `+ ${rupiahAmount}`;
        } else if (transaction.type === 'expense') {
            displayAmount = `- ${rupiahAmount}`;
        } else {
            displayAmount = `💰 ${rupiahAmount}`;
        }
        
        item.innerHTML = `
            <div>
                <span class="history-date">${transaction.date}</span>
                <p><strong>${transaction.text}</strong><br><small>${transaction.category}</small></p>
            </div>
            <span>${displayAmount}</span>
            <div class="actions">
                <button onclick="editTransaction(${transaction.id})" class="action-btn edit-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button onclick="removeTransaction(${transaction.id})" class="action-btn delete-btn" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;

        listEl.appendChild(item);
    }

    function updateValues(filteredTransactions) {
        const income = filteredTransactions
            .filter(item => item.type === 'income')
            .reduce((acc, item) => acc + item.amount, 0);

        const expense = filteredTransactions
            .filter(item => item.type === 'expense')
            .reduce((acc, item) => acc + item.amount, 0);
            
        const saving = filteredTransactions
            .filter(item => item.type === 'saving')
            .reduce((acc, item) => acc + item.amount, 0);

        const totalExpenseAndSaving = expense + saving;
        const balance = income - totalExpenseAndSaving; // Saldo sesungguhnya

        // --- PERBAIKAN LOGIKA TAMPILAN SALDO ---
        let displayBalance;
        if (balance < 0) {
            // Tampilkan tanda "-" di depan hasil formatRupiah (yang menggunakan Math.abs)
            displayBalance = `- ${formatRupiah(balance)}`; 
        } else {
            displayBalance = formatRupiah(balance);
        }
        // ---------------------------------------

        incomeEl.innerText = formatRupiah(income);
        expenseEl.innerText = formatRupiah(totalExpenseAndSaving); // Tampilkan total pengeluaran + saving
        balanceEl.innerText = displayBalance; 

        return { income, expense: totalExpenseAndSaving, balance, saving }; 
    }

    function generateAIComment(stats) {
        let comment = "Selamat datang! Masukkan transaksi pertamamu untuk memulai analisis cerdas.";
        const { income, expense, balance } = stats; // expense kini mencakup saving

        if (transactions.length === 0) {
            personaDescEl.innerText = comment;
            return;
        }

        if (balance >= 0) {
            if (expense === 0 && income > 0) {
                 comment = "💰 Hebat! Bulan ini kamu belum mencatat pengeluaran, atau semuanya berjalan sangat baik. Kelola sisa saldo kamu!";
            } else if (balance > 0.5 * income && income > 0) {
                comment = `✨ Kinerja keuangan sangat baik! Saldo sisa (${formatRupiah(balance)}) menunjukkan pengelolaan uang yang **disiplin**. Pertahankan!`;
            } else if (balance > 0) {
                comment = `👍 Bagus. Pemasukan lebih besar dari pengeluaran (${formatRupiah(balance)}). Coba alokasikan lebih banyak untuk target tabungan bulan depan.`;
            } else {
                comment = "Sisa saldo Rp 0. Arus kas bulan ini netral. Pertimbangkan pengeluaranmu.";
            }
        } else {
            // Logika untuk Saldo Minus
            const absBalance = Math.abs(balance);
            if (income > 0 && expense > 1.2 * income) {
                comment = `🚨 **KRITIS!** Pengeluaran total kamu (${formatRupiah(expense)}) jauh melebihi pemasukan. Saldo minus ${formatRupiah(absBalance)}. Segera tinjau!`;
            } else {
                comment = `⚠️ Saldo kamu **defisit** sebesar ${formatRupiah(absBalance)}. Ini alarm! Cari tahu sumber kebocoran dan kurangi pengeluaran non-esensial.`;
            }
        }
        
        personaDescEl.innerText = comment;
    }

    // --- CHART LOGIC ---
    
    function updateCharts(filteredTransactions) {
        // 1. Expense by Category Chart (Donut/Doughnut)
        const expenseData = filteredTransactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => {
                acc[t.category] = (acc[t.category] || 0) + t.amount;
                return acc;
            }, {});

        const expenseLabels = Object.keys(expenseData);
        const expenseAmounts = Object.values(expenseData);

        const colors = ['#ff7675', '#a29bfe', '#ffeaa7', '#00b894', '#fd79a8', '#6c5ce7', '#0984e3', '#f39c12', '#d63031'];
        
        if (expenseChartInstance) {
            expenseChartInstance.destroy();
        }
        
        if (ctxExpense) {
            expenseChartInstance = new Chart(ctxExpense, {
                type: 'doughnut',
                data: {
                    labels: expenseLabels,
                    datasets: [{
                        data: expenseAmounts,
                        backgroundColor: colors.slice(0, expenseLabels.length),
                        borderColor: '#fff',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' },
                        tooltip: { 
                            callbacks: { 
                                label: (context) => `${context.label}: ${formatRupiah(context.parsed)}` 
                            } 
                        }
                    }
                }
            });
        }
        
        // 2. Monthly Trend Chart (Bar)
        const currentMonth = getCurrentMonthKey();
        if (!currentMonth) return;

        const daysInMonth = new Date(currentMonth.split('-')[0], currentMonth.split('-')[1], 0).getDate();
        const trendLabels = Array.from({length: daysInMonth}, (_, i) => i + 1); 

        const dailyData = Array(daysInMonth).fill(0).map((_, i) => {
            const dayString = String(i + 1).padStart(2, '0');
            const dailyIncome = filteredTransactions
                .filter(t => t.date.endsWith(dayString) && t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);

            // Pengeluaran Harian mencakup Expense dan Saving
            const dailyExpense = filteredTransactions
                .filter(t => t.date.endsWith(dayString) && (t.type === 'expense' || t.type === 'saving'))
                .reduce((sum, t) => sum + t.amount, 0);
            
            return { income: dailyIncome, expense: dailyExpense };
        });


        if (trendChartInstance) {
            trendChartInstance.destroy();
        }

        if (ctxTrend) {
            trendChartInstance = new Chart(ctxTrend, {
                type: 'bar',
                data: {
                    labels: trendLabels, 
                    datasets: [
                        {
                            label: 'Pemasukan Harian',
                            data: dailyData.map(d => d.income),
                            backgroundColor: '#00b894',
                            borderRadius: 4,
                        },
                        {
                            label: 'Pengeluaran Harian',
                            data: dailyData.map(d => d.expense),
                            backgroundColor: '#ff7675',
                            borderRadius: 4,
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Jumlah (Rp)' } },
                        x: { title: { display: true, text: 'Tanggal (Hari)' } }
                    },
                    plugins: {
                        legend: { position: 'top' },
                        tooltip: { mode: 'index', intersect: false, 
                            callbacks: { 
                                label: (context) => `${context.dataset.label}: ${formatRupiah(context.parsed.y)}` 
                            } 
                        }
                    }
                }
            });
        }
    }


    // --- EXPORT CSV LOGIC ---

    function convertToCSV(data) {
        if (data.length === 0) return '';

        const headers = ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Deskripsi', 'Jumlah'];

        const csvArray = [];
        csvArray.push(headers.join(','));

        data.forEach(item => {
            // Logika: Income = Positif (+), Expense/Saving = Negatif (-)
            let amountSign = item.amount;
            if (item.type === 'expense' || item.type === 'saving') {
                amountSign = -item.amount;
            }
            
            const amountClean = amountSign.toString().replace(/\./g, '');
            
            const escapedText = item.text.replace(/"/g, '""'); 
            
            const row = [
                item.id,
                item.date,
                item.type.charAt(0).toUpperCase() + item.type.slice(1),
                item.category,
                `"${escapedText}"`, 
                amountClean
            ];
            csvArray.push(row.join(','));
        });

        return csvArray.join('\n');
    }

    function downloadCSV(csv, filename) {
        const csvFile = new Blob(["\ufeff", csv], { type: 'text/csv;charset=utf-8;' }); 
        const downloadLink = document.createElement('a');
        
        const monthKey = getCurrentMonthKey();
        downloadLink.download = `Laporan_Keuangan_${filename}_${monthKey}.csv`;
        
        downloadLink.href = URL.createObjectURL(csvFile);
        downloadLink.style.display = 'none';
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }
    
    exportBtn.addEventListener('click', () => {
        const dataToExport = getFilteredTransactions(); 

        if (dataToExport.length === 0) {
            alert('Tidak ada data transaksi di bulan ini untuk diekspor.');
            return;
        }

        const csvData = convertToCSV(dataToExport);
        downloadCSV(csvData, 'Transaksi');
    });

    // --- RESET DATA ---
    resetBtn.addEventListener('click', () => {
        if (confirm('APAKAH ANDA YAKIN INGIN MENGHAPUS SEMUA DATA TRANSAKSI DAN TARGET TABUNGAN? Aksi ini tidak dapat dibatalkan.')) {
            localStorage.removeItem('transactions');
            localStorage.removeItem('savingGoals');
            transactions = [];
            savingGoals = {};
            updateUI();
            alert('Semua data telah direset.');
        }
    });

    // --- MAIN UPDATE FUNCTION ---

    function updateUI() {
        const filteredTransactions = getFilteredTransactions().sort((a, b) => new Date(b.date) - new Date(a.date)); 
        
        listEl.innerHTML = '';
        if (filteredTransactions.length === 0) {
            listEl.innerHTML = '<li style="justify-content: center; font-style: italic; color: #7f8c8d;">Belum ada transaksi di bulan ini.</li>';
        } else {
            filteredTransactions.forEach(addTransactionDOM);
        }

        const stats = updateValues(filteredTransactions);
        updateSavingGoalUI(); 
        updateCharts(filteredTransactions); 
        generateAIComment(stats);
    }

    // --- START APP ---
    init();
});
