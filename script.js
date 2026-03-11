/**
 * listPlannerPro - Core Logic
 * Senior Frontend Developer Implementation
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const taskInput = document.getElementById('task-input');
    const addBtn = document.getElementById('add-btn');
    const taskList = document.getElementById('task-list');
    const exportBtn = document.getElementById('export-btn');
    const importInput = document.getElementById('import-csv');
    const clearBtn = document.getElementById('clear-btn');

    // State
    let items = JSON.parse(localStorage.getItem('items')) || [];
    let currentDate = new Date();
    let plan_semanal = JSON.parse(localStorage.getItem('plan_semanal')) || {};

    const categoryInput = document.getElementById('category-input');
    const tabInventory = document.getElementById('tab-inventory');
    const tabPlanner = document.getElementById('tab-planner');
    const sectionInventory = document.getElementById('section-inventory');
    const sectionPlanner = document.getElementById('section-planner');

    /**
     * Generador de IDs Estandarizados (item_001)
     */
    const generateId = (index) => {
        return `item_${String(index + 1).padStart(3, '0')}`;
    };

    /**
     * Migración de IDs antiguos al formato estandarizado
     */
    const migrateIds = () => {
        if (items.length === 0) return;
        let needsMigration = items.some(item => !/^item_\d{3}$/.test(item.id));
        if (!needsMigration && items.length > 0) return;

        console.log("Iniciando migración de IDs...");
        const idMap = {};
        const newItems = items.map((item, index) => {
            const newId = generateId(index);
            idMap[item.id] = newId;
            return { ...item, id: newId };
        });

        // Actualizar Referencias en el Planificador
        const newPlan = {};
        for (let date in plan_semanal) {
            newPlan[date] = {};
            for (let cat in plan_semanal[date]) {
                const oldId = plan_semanal[date][cat];
                if (idMap[oldId]) {
                    newPlan[date][cat] = idMap[oldId];
                } else if (/^item_\d{3}$/.test(oldId)) {
                    // Si ya era un ID válido pero no estaba en el mapeo (caso raro)
                    newPlan[date][cat] = oldId;
                } else {
                    // ID antiguo sin correspondencia (item eliminado previo a migración)
                    delete newPlan[date][cat];
                }
            }
        }

        items = newItems;
        plan_semanal = newPlan;
        localStorage.setItem('items', JSON.stringify(items));
        localStorage.setItem('plan_semanal', JSON.stringify(plan_semanal));
    };

    /**
     * Seguridad: Sanitización de texto
     * Evita XSS al limpiar caracteres especiales
     */
    const sanitize = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.textContent;
    };

    /**
     * Persistencia: Guardar en localStorage
     */
    const saveItems = () => {
        localStorage.setItem('items', JSON.stringify(items));
        renderItems();
        populateTable(); // Refrescar celdas si cambian nombres
    };

    /**
     * Renderizado de Inventario Seguro
     */
    const renderItems = () => {
        taskList.textContent = ''; 

        items.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'task-item';

            const contentWrap = document.createElement('div');
            contentWrap.className = 'task-content';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = item.text;
            
            const categorySpan = document.createElement('small');
            categorySpan.style.display = 'block';
            categorySpan.style.color = 'var(--text-muted)';
            categorySpan.textContent = item.category;

            contentWrap.appendChild(nameSpan);
            contentWrap.appendChild(categorySpan);

            const actionsWrap = document.createElement('div');
            actionsWrap.className = 'item-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.textContent = '✏️';
            editBtn.title = 'Editar';
            editBtn.onclick = () => editItem(index);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-task';
            deleteBtn.textContent = '✕';
            deleteBtn.title = 'Eliminar';
            deleteBtn.onclick = () => {
                if (confirm(`¿Eliminar ${item.text}? Se quitará también del calendario.`)) {
                    // Limpiar del plan_semanal
                    cleanPlannerOfItem(item.id);
                    items.splice(index, 1);
                    saveItems();
                }
            };

            actionsWrap.appendChild(editBtn);
            actionsWrap.appendChild(deleteBtn);

            li.appendChild(contentWrap);
            li.appendChild(actionsWrap);
            taskList.appendChild(li);
        });
    };

    /**
     * Lógica de Edición Retroactiva
     */
    const editItem = (index) => {
        const item = items[index];
        const newName = prompt("Nuevo nombre para la prenda:", item.text);
        
        if (newName && newName.trim() !== "" && newName !== item.text) {
            const cleanName = sanitize(newName.trim());
            
            // Verificar si está en el planificador
            const isPlanned = checkItemInPlanner(item.id);
            
            if (isPlanned) {
                const updateAll = confirm("Esta prenda está planificada. ¿Actualizar en todo el calendario (Aceptar) o duplicar como nueva (Cancelar)?");
                if (updateAll) {
                    items[index].text = cleanName;
                } else {
                    items.push({ id: generateId(items.length), text: cleanName, category: item.category });
                }
            } else {
                items[index].text = cleanName;
            }
            saveItems();
        }
    };

    const checkItemInPlanner = (id) => {
        for (let date in plan_semanal) {
            for (let cat in plan_semanal[date]) {
                if (plan_semanal[date][cat] === id) return true;
            }
        }
        return false;
    };

    const cleanPlannerOfItem = (id) => {
        for (let date in plan_semanal) {
            for (let cat in plan_semanal[date]) {
                if (plan_semanal[date][cat] === id) {
                    delete plan_semanal[date][cat];
                }
            }
        }
        localStorage.setItem('plan_semanal', JSON.stringify(plan_semanal));
    };

    /**
     * Añadir Prenda con ID Normalizado
     */
    const addItem = () => {
        const text = taskInput.value.trim();
        const category = categoryInput.value;
        if (text) {
            const cleanText = sanitize(text);
            const newId = generateId(items.length);
            items.push({ id: newId, text: cleanText, category: category });
            taskInput.value = '';
            saveItems();
        }
    };

    /**
     * Exportar a CSV
     */
    const exportToCSV = () => {
        if (items.length === 0) return alert('No hay prendas para exportar.');

        let csvContent = '\ufeff';
        csvContent += 'ID,Nombre,Categoria\n';

        items.forEach((item, index) => {
            const escapedText = item.text.replace(/"/g, '""');
            csvContent += `${item.id},"${escapedText}","${item.category}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'Inventario_ListPlannerPro.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    /**
     * Importar desde CSV
     */
    const importFromCSV = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            const lines = content.split(/\r?\n/);
            const newItems = [];

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i]) continue;
                const match = lines[i].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
                if (match && match.length >= 3) {
                    let name = match[1].replace(/^"|"$/g, '').replace(/""/g, '"');
                    let cat = match[2].replace(/^"|"$/g, '');
                    
                    if (name.trim()) {
                        const newId = generateId(items.length + newItems.length);
                        newItems.push({
                            id: newId,
                            text: sanitize(name.trim()),
                            category: cat || 'Blusa'
                        });
                    }
                }
            }

            if (newItems.length > 0) {
                if (confirm(`¿Importar ${newItems.length} prendas?`)) {
                    items = [...items, ...newItems];
                    saveItems();
                }
            }
            importInput.value = '';
        };
        reader.readAsText(file);
    };

    // --- Weekly Planner Logic ---

    /**
     * Calcula el lunes de la semana actual
     */
    const getMonday = (d) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(date.setDate(diff));
    };

    /**
     * Formatea el rango de fechas (ej: '11 Mar - 15 Mar')
     */
    const formatDateRange = (monday) => {
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);
        
        const options = { day: '2-digit', month: 'short' };
        return `${monday.toLocaleDateString('es-ES', options)} - ${friday.toLocaleDateString('es-ES', options)}`;
    };

    /**
     * Renderizado de Celdas: Población de la tabla con selectores
     */
    const populateTable = () => {
        const monday = getMonday(currentDate);
        const weekDisplay = document.getElementById('current-week-display');
        if (weekDisplay) weekDisplay.textContent = formatDateRange(monday);

        const rows = document.querySelectorAll('#weekly-table tbody tr');
        rows.forEach(row => {
            const category = row.dataset.category;
            const cells = row.querySelectorAll('td[data-day]');
            
            cells.forEach(cell => {
                cell.textContent = ''; // Limpiar de forma segura
                const dayOffset = parseInt(cell.dataset.day);
                const cellDate = new Date(monday);
                cellDate.setDate(monday.getDate() + dayOffset);
                const dateKey = cellDate.toISOString().split('T')[0];

                const select = document.createElement('select');
                
                // Opción vacía
                const emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.textContent = '';
                select.appendChild(emptyOpt);

                // Filtrar del inventario de localStorage
                const filtered = items.filter(item => item.category === category);
                filtered.forEach(item => {
                    const opt = document.createElement('option');
                    opt.value = item.id;
                    opt.textContent = item.text;
                    select.appendChild(opt);
                });

                // Cargar valor previamente guardado
                if (plan_semanal[dateKey] && plan_semanal[dateKey][category]) {
                    select.value = plan_semanal[dateKey][category];
                } else {
                    select.value = '';
                }

                // Persistencia de Selección optimizada
                select.onchange = (e) => {
                    const val = e.target.value;
                    if (!plan_semanal[dateKey]) plan_semanal[dateKey] = {};
                    
                    if (val === "") {
                        delete plan_semanal[dateKey][category];
                        // Si la fecha queda vacía, eliminar la clave de la fecha
                        if (Object.keys(plan_semanal[dateKey]).length === 0) {
                            delete plan_semanal[dateKey];
                        }
                    } else {
                        plan_semanal[dateKey][category] = val;
                    }
                    localStorage.setItem('plan_semanal', JSON.stringify(plan_semanal));
                };

                cell.appendChild(select);
            });
        });
    };

    // Event Listeners
    addBtn.addEventListener('click', addItem);
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addItem();
    });

    exportBtn.addEventListener('click', exportToCSV);
    importInput.addEventListener('change', importFromCSV);

    clearBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres borrar todo el inventario?')) {
            items = [];
            plan_semanal = {};
            localStorage.removeItem('plan_semanal');
            saveItems();
        }
    });

    // Tab Logic
    tabInventory.addEventListener('click', () => {
        tabInventory.classList.add('active');
        tabPlanner.classList.remove('active');
        sectionInventory.classList.remove('hidden');
        sectionPlanner.classList.add('hidden');
    });

    tabPlanner.addEventListener('click', () => {
        tabPlanner.classList.add('active');
        tabInventory.classList.remove('active');
        sectionPlanner.classList.remove('hidden');
        sectionInventory.classList.add('hidden');
        populateTable();
    });

    // Planner Navigation Events
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() - 7);
            populateTable();
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() + 7);
            populateTable();
        });
    }

    // Toggle View (Bonus for verification, can be removed)
    // Para ver el planificador, el usuario puede llamar a showPlanner()
    window.showPlanner = () => {
        document.getElementById('app').style.display = 'none';
        document.getElementById('planner-view').style.display = 'block';
        populateTable();
    };

    // Initial Render
    migrateIds(); // Ejecutar migración antes de renderizar
    renderItems();
    populateTable();
});
