// инициализация карты
var map = L.map('map').setView([55.7558, 37.6173], 11);

// для режима удаления
var deleteMode = false;
var selectedMarkers = [];

// слой карты
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// данные меток
var markersData = [];

// ключ для localStorage
var STORAGE_KEY = 'travel_map_markers';

// отмена обработки фото
var currentPhotoProcessor = null;


// функция сжатия фото перед сохранением
function compressImage(file, maxWidth = 800, maxHeight = 600, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // новые размеры с сохранением размеров
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // в base64 с качеством
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve({
                    data: compressedBase64,
                    name: file.name,
                    size: compressedBase64.length,
                    originalSize: file.size
                });
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// функция проверки размера хранилища
function checkStorageSize() {
    let totalSize = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            totalSize += localStorage[key].length;
        }
    }
    console.log('Current storage size:', totalSize, 'bytes');
    return totalSize;
}

// функция очистки старых данных если нужно
function cleanupOldDataIfNeeded() {
    const MAX_STORAGE_SIZE = 4 * 1024 * 1024;
    const currentSize = checkStorageSize();
    
    if (currentSize > MAX_STORAGE_SIZE * 0.9) {
        console.warn('Storage almost full, cleaning up...');
        alert('Storage is almost full. Consider deleting some old markers.');
    }
}

// функция сохранения маркеров в localStorage
function saveMarkersToStorage() {
    try {
        var markersToSave = markersData.map(function(markerData) {
            return {
                id: markerData.id,
                title: markerData.title,
                description: markerData.description,
                date: markerData.date,
                category: markerData.category,
                coords: markerData.coords,
                photos: markerData.photos ? markerData.photos.map(photo => ({
                    data: photo.data,
                    name: photo.name
                })) : []
            };
        });
        
        const dataToSave = JSON.stringify(markersToSave);
        
        // проверка размера данных перед сохранением
        if (dataToSave.length > 4 * 1024 * 1024) {
            console.error('Data too large for localStorage:', dataToSave.length);
            alert('Too much data to save. Please delete some markers with photos.');
            return false;
        }
        
        localStorage.setItem(STORAGE_KEY, dataToSave);
        console.log('Markers saved to localStorage:', markersToSave.length, 'Size:', dataToSave.length, 'bytes');
        return true;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        alert('Error saving data. Storage might be full.');
        return false;
    }
}

// функция загрузки маркеров из localStorage
function loadMarkersFromStorage() {
    var savedMarkers = localStorage.getItem(STORAGE_KEY);
    
    if (savedMarkers) {
        try {
            var markersArray = JSON.parse(savedMarkers);
            console.log('Markers loaded from localStorage:', markersArray.length);
            
            markersArray.forEach(function(markerData) {
                var coordArray = markerData.coords.split(',').map(coord => parseFloat(coord.trim()));
                createMarker(
                    markerData.id,
                    coordArray,
                    markerData.title,
                    markerData.description,
                    markerData.date,
                    markerData.category,
                    markerData.coords,
                    markerData.photos || []
                );
            });
            
            return true;
        } catch (error) {
            console.error('Error loading markers from localStorage:', error);
            return false;
        }
    }
    return false;
}

// функция очистки хранилища 
function clearStorage() {
    localStorage.removeItem(STORAGE_KEY);
    console.log('Storage cleared');
}

// функция для удаления фото из хранилища
function clearAllPhotos() {
    markersData.forEach(markerData => {
        markerData.photos = [];
    });
    saveMarkersToStorage();
    console.log('All photos cleared from storage');
    alert('All photos have been cleared to free up storage space.');
}

// обработчик для клика по карте
map.on('click', function(e) {
    if (!deleteMode) {
        var coords = e.latlng;
        document.getElementById('coords').value = coords.lat.toFixed(4) + ', ' + coords.lng.toFixed(4);
        
        document.getElementById('photos').value = '';
        updateFileCounter();
        
        document.getElementById('overlay').style.display = 'block';
        document.getElementById('placeForm').style.display = 'flex';
    }
});

// обработчик для изменения выбора файлов
document.getElementById('photos').addEventListener('change', function() {
    updateFileCounter();
});

// функция обновления счетчика файлов
function updateFileCounter() {
    var photosInput = document.getElementById('photos');
    var fileStatus = document.getElementById('fileStatus');
    
    if (!fileStatus) {
        fileStatus = document.createElement('span');
        fileStatus.id = 'fileStatus';
        fileStatus.className = 'file-name';
        photosInput.parentNode.insertBefore(fileStatus, photosInput.nextSibling);
    }
    
    if (photosInput.files.length > 0) {
        var fileText = photosInput.files.length === 1 ? 'file selected' : 'files selected';
        fileStatus.textContent = photosInput.files.length + ' ' + fileText;
        fileStatus.classList.remove('hidden');
    } else {
        fileStatus.textContent = 'No files selected';
        fileStatus.classList.remove('hidden');
    }
}

// обработчик для кнопки поиска
document.getElementById('searchBtn').addEventListener('click', function() {
    filterMarkers();
});

// обработчик для кнопки сброса
document.getElementById('resetBtn').addEventListener('click', function() {
    resetFilters();
});

// обработчик для кнопки удаления
document.getElementById('deleteBtn').addEventListener('click', function() {
    if (!deleteMode) {
        enterDeleteMode();
    } else {
        if (selectedMarkers.length > 0) {
            showDeleteModal();
        } else {
            exitDeleteMode();
        }
    }
});

// функция входа в режим удаления
function enterDeleteMode() {
    deleteMode = true;
    var deleteBtn = document.getElementById('deleteBtn');
    
    deleteBtn.textContent = 'Confirm Delete (' + selectedMarkers.length + ' selected)';
    deleteBtn.classList.add('delete-mode');
    selectedMarkers = [];
    
    map.getContainer().classList.add('delete-mode-cursor');
    document.getElementById('map').classList.add('map-delete-mode');
    
    markersData.forEach(function(markerData) {
        markerData.marker.off('click');
        markerData.marker.on('click', function(e) {
            if (deleteMode) {
                toggleMarkerSelection(markerData);
                updateDeleteButton();
                e.originalEvent.stopPropagation();
            }
        });
    });
    
    document.getElementById('searchBtn').disabled = true;
    document.getElementById('resetBtn').disabled = true;
}

// функция выхода из режима удаления
function exitDeleteMode() {
    deleteMode = false;
    var deleteBtn = document.getElementById('deleteBtn');
    
    deleteBtn.textContent = 'Delete';
    deleteBtn.classList.remove('delete-mode');
    
    map.getContainer().classList.remove('delete-mode-cursor');
    document.getElementById('map').classList.remove('map-delete-mode');
    
    // сбрасывание выделение всех маркеров 
    markersData.forEach(function(markerData) {
        if (markerData.marker.getElement()) {
            markerData.marker.getElement().classList.remove('marker-selected');
        }
    });
    selectedMarkers = [];
    
    // стандартные обработчики для всех маркеров
    markersData.forEach(function(markerData) {
    markerData.marker.off('click');
    
    // стандартный обработчик переключения popup
    markerData.marker.on('click', function(e) {
        if (markerData.marker.isPopupOpen()) {
            markerData.marker.closePopup();
        } else {
            markerData.marker.openPopup();
        }
        e.originalEvent.stopPropagation();
    });
});
    
    // вкл кнопки
    document.getElementById('searchBtn').disabled = false;
    document.getElementById('resetBtn').disabled = false;
    
    console.log('Exit delete mode');
}

// функция переключения выбора маркера
function toggleMarkerSelection(markerData) {
    var markerElement = markerData.marker.getElement();
    var index = selectedMarkers.indexOf(markerData);
    
    if (index === -1) {
        selectedMarkers.push(markerData);
        markerElement.classList.add('marker-selected');
    } else {
        selectedMarkers.splice(index, 1);
        markerElement.classList.remove('marker-selected');
    }
}

// функция обновления текста кнопки удаления
function updateDeleteButton() {
    var deleteBtn = document.getElementById('deleteBtn');
    if (deleteMode) {
        deleteBtn.textContent = 'Confirm Delete (' + selectedMarkers.length + ' selected)';
    }
}

// обработчик для кнопки подтверждения удаления
document.getElementById('confirmDeleteBtn').addEventListener('click', function() {
    deleteSelectedMarkers();
    hideDeleteModal();
    exitDeleteMode();
});

// обработчик для кнопки отмены удаления
document.getElementById('cancelDeleteBtn').addEventListener('click', function() {
    hideDeleteModal();
    exitDeleteMode();
});

// функция показа модального окна удаления
function showDeleteModal() {
    document.getElementById('deleteCount').textContent = selectedMarkers.length;
    document.getElementById('deleteModal').style.display = 'flex';
}

// функция скрытия модального окна удаления
function hideDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
}

// функция удаления выбранных маркеров
function deleteSelectedMarkers() {
    selectedMarkers.forEach(function(markerData) {
        map.removeLayer(markerData.marker);
        
        var index = markersData.indexOf(markerData);
        if (index !== -1) {
            markersData.splice(index, 1);
        }
    });
    
    saveMarkersToStorage();
    selectedMarkers = [];
}

// функция редактирования выбранного маркера
function editMarker(markerId) {
    var markerData = markersData.find(m => m.id === markerId);
    if (!markerData) return;

    // заполнение формы старыми данными
    document.getElementById('title').value = markerData.title;
    document.getElementById('description').value = markerData.description;
    document.getElementById('date').value = markerData.date;
    document.getElementById('category').value = markerData.category;
    document.getElementById('coords').value = markerData.coords;

    showCurrentPhotos(markerData.photos);

    document.getElementById('overlay').style.display = 'block';
    document.getElementById('placeForm').style.display = 'flex';

    // save на Update
    var saveBtn = document.getElementById('saveBtn');
    saveBtn.textContent = 'Update';
    saveBtn.dataset.editingId = markerId;
    saveBtn.dataset.originalPhotos = JSON.stringify(markerData.photos || []);
}

// функция показа текущих фото
function showCurrentPhotos(photos) {
    var currentPhotosSection = document.getElementById('currentPhotosSection');
    var currentPhotosList = document.getElementById('currentPhotosList');
    
    currentPhotosList.innerHTML = '';
    
    if (photos && photos.length > 0) {
        currentPhotosSection.style.display = 'block';
        
        photos.forEach((photo, index) => {
            var photoItem = document.createElement('div');
            photoItem.className = 'current-photo-item';
            photoItem.innerHTML = `
                <img src="${photo.data}" alt="${photo.name}" class="current-photo-thumb">
                <span class="current-photo-name">${photo.name}</span>
                <button type="button" class="remove-photo-btn" data-index="${index}">×</button>
            `;
            currentPhotosList.appendChild(photoItem);
        });
        
        // обработчики для кнопок удаления
        document.querySelectorAll('.remove-photo-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                var index = parseInt(this.getAttribute('data-index'));
                removePhotoFromEdit(index);
            });
        });
    } else {
        currentPhotosSection.style.display = 'none';
    }
}

// функция удаления фото в режиме редактирования
function removePhotoFromEdit(index) {
    var saveBtn = document.getElementById('saveBtn');
    var originalPhotos = JSON.parse(saveBtn.dataset.originalPhotos || '[]');
    
    // удаляем фото из массива
    originalPhotos.splice(index, 1);
    saveBtn.dataset.originalPhotos = JSON.stringify(originalPhotos);
    
    showCurrentPhotos(originalPhotos);
}


// обработчик для Enter в поле поиска
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        filterMarkers();
    }
});

// функция фильтрации маркеров
function filterMarkers() {
    var searchText = document.getElementById('searchInput').value.toLowerCase();
    var selectedCategory = document.getElementById('filterCategory').value;
    
    markersData.forEach(function(markerData) {
        var matchesSearch = true;
        var matchesCategory = true;
        
        if (searchText) {
            var titleMatch = markerData.title.toLowerCase().includes(searchText);
            var descriptionMatch = markerData.description.toLowerCase().includes(searchText);
            matchesSearch = titleMatch || descriptionMatch;
        }
        
        if (selectedCategory !== 'all') {
            matchesCategory = markerData.category === selectedCategory;
        }
        
        if (matchesSearch && matchesCategory) {
            markerData.marker.addTo(map);
        } else {
            markerData.marker.remove();
        }
    });
}

// функция сброса фильтров
function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterCategory').value = 'all';
    
    markersData.forEach(function(markerData) {
        markerData.marker.addTo(map);
    });
}

// обработчик для кнопки отмены в форме
document.getElementById('cancelBtn').addEventListener('click', function() {
    closeForm();
});

// обработчик для кнопки сохранения
document.getElementById('saveBtn').addEventListener('click', function() {
    var title = document.getElementById('title').value;
    var description = document.getElementById('description').value;
    var date = document.getElementById('date').value;
    var category = document.getElementById('category').value;
    var coords = document.getElementById('coords').value;
    var photosInput = document.getElementById('photos');

    var saveBtn = document.getElementById('saveBtn');

    // режим редактирования
    if (saveBtn.dataset.editingId) {
        var markerId = saveBtn.dataset.editingId;
        var markerData = markersData.find(m => m.id === markerId);

        if (markerData) {
            // получаем оригинальные фото (возможно, уже отредактированные - удалены некоторые)
            var originalPhotos = JSON.parse(saveBtn.dataset.originalPhotos || '[]');
            
            var saveBtn = document.getElementById('saveBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Processing...';

            var files = photosInput.files;
            
            if (files.length > 0) {
                // Есть новые фото для обработки
                if (currentPhotoProcessor) {
                    currentPhotoProcessor.cancel = true;
                }
                
                currentPhotoProcessor = {
                    cancel: false,
                    markerId: markerId,
                    isEditMode: true,
                    originalPhotos: originalPhotos
                };
                
                processPhotosForEdit(files, markerId, markerData, title, description, date, category, coords, saveBtn);
            } else {
                // нет новых фото, просто обновляем данные
                updateMarkerWithNewData(markerData, title, description, date, category, coords, originalPhotos);
                closeForm();
                saveBtn.disabled = false;
                saveBtn.textContent = 'Update';
            }
        }
        return;
    }
    
    if (title && coords) {
        var coordArray = coords.split(',').map(coord => parseFloat(coord.trim()));
        var markerId = 'marker_' + Date.now();
        
        var saveBtn = document.getElementById('saveBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Processing photos...';
        
        var files = photosInput.files;
        
        if (files.length > 0) {
            if (currentPhotoProcessor) {
                currentPhotoProcessor.cancel = true;
            }
            
            currentPhotoProcessor = {
                cancel: false,
                markerId: markerId
            };
            
            processPhotosForNewMarker(files, markerId, coordArray, title, description, date, category, coords, saveBtn);
        } else {
            createMarker(markerId, coordArray, title, description, date, category, coords, []);
            closeForm();
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
        }
    }
});

// функция обработки фото для режима редактирования
function processPhotosForEdit(files, markerId, markerData, title, description, date, category, coords, saveBtn) {
    var newPhotos = [];
    var filesProcessed = 0;
    var totalFiles = files.length;
    var processor = currentPhotoProcessor;
    
    saveBtn.textContent = 'Compressing new photos... 0/' + totalFiles;
    
    async function processNextFile() {
        if (processor && processor.cancel) {
            console.log('Photo processing cancelled');
            resetSaveButton(saveBtn);
            return;
        }
        
        if (filesProcessed < totalFiles) {
            var file = files[filesProcessed];
            
            try {
                const compressedPhoto = await compressImage(file);
                
                if (processor && !processor.cancel) {
                    newPhotos.push({
                        id: markerId,
                        data: compressedPhoto.data,
                        name: compressedPhoto.name,
                        compressedSize: compressedPhoto.size,
                        originalSize: compressedPhoto.originalSize
                    });
                    
                    filesProcessed++;
                    saveBtn.textContent = 'Compressing new photos... ' + filesProcessed + '/' + totalFiles;
                    
                    console.log(`New photo ${filesProcessed}/${totalFiles} compressed:`, 
                        compressedPhoto.originalSize + ' → ' + compressedPhoto.size + ' bytes');
                    
                    processNextFile();
                }
            } catch (error) {
                console.error('Error compressing image:', error);
                filesProcessed++;
                processNextFile();
            }
        } else {
            if (processor && !processor.cancel) {
                console.log('All new photos compressed, updating marker...');
                
                // объединяем старые фото (которые не были удалены) с новыми
                var finalPhotos = [...processor.originalPhotos, ...newPhotos];
                updateMarkerWithNewData(markerData, title, description, date, category, coords, finalPhotos);
                
                closeForm();
                resetSaveButton(saveBtn);
                currentPhotoProcessor = null;
            }
        }
    }
    
    processNextFile();
}

// функция для обработки фото при создании новой метки
function processPhotosForNewMarker(files, markerId, coords, title, description, date, category, coordsText, saveBtn) {
    var photos = [];
    var filesProcessed = 0;
    var totalFiles = files.length;
    var processor = currentPhotoProcessor;
    
    saveBtn.textContent = 'Compressing photos... 0/' + totalFiles;
    
    async function processNextFile() {
        if (processor && processor.cancel) {
            console.log('Photo processing cancelled');
            resetSaveButton(saveBtn);
            return;
        }
        
        if (filesProcessed < totalFiles) {
            var file = files[filesProcessed];
            
            try {
                const compressedPhoto = await compressImage(file);
                
                if (processor && !processor.cancel) {
                    photos.push({
                        id: markerId,
                        data: compressedPhoto.data,
                        name: compressedPhoto.name,
                        compressedSize: compressedPhoto.size,
                        originalSize: compressedPhoto.originalSize
                    });
                    
                    filesProcessed++;
                    saveBtn.textContent = 'Compressing photos... ' + filesProcessed + '/' + totalFiles;
                    
                    console.log(`Photo ${filesProcessed}/${totalFiles} compressed:`, 
                        compressedPhoto.originalSize + ' → ' + compressedPhoto.size + ' bytes');
                    
                    processNextFile();
                }
            } catch (error) {
                console.error('Error compressing image:', error);
                filesProcessed++;
                processNextFile();
            }
        } else {
            if (processor && !processor.cancel) {
                console.log('All photos compressed, creating marker...');
                createMarker(markerId, coords, title, description, date, category, coordsText, photos);
                closeForm();
                resetSaveButton(saveBtn);
                currentPhotoProcessor = null;
            }
        }
    }
    
    processNextFile();
}

// функция обновления данных маркера
function updateMarkerWithNewData(markerData, title, description, date, category, coords, photos) {
    markerData.title = title;
    markerData.description = description;
    markerData.date = date;
    markerData.category = category;
    markerData.coords = coords;
    markerData.photos = photos;

    // обновление иконки маркера по категории
    var newIcon = getCategoryIcon(category);
    markerData.marker.setIcon(newIcon);

    // обновление popup
    var popupContent = generatePopupContent(markerData.id, title, description, date, category, coords, photos);
    markerData.marker.setPopupContent(popupContent);

    saveMarkersToStorage();
    console.log('Marker updated:', title, 'with', photos.length, 'photos');
}


// функция сброса кнопки сохранения
function resetSaveButton(saveBtn) {
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }
}

// функция закрытия формы
function closeForm() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('placeForm').style.display = 'none';
    
    document.getElementById('title').value = '';
    document.getElementById('description').value = '';
    document.getElementById('date').value = '';
    document.getElementById('coords').value = '';
    document.getElementById('photos').value = '';
    
    // скрываем секцию текущих фото
    document.getElementById('currentPhotosSection').style.display = 'none';
    document.getElementById('currentPhotosList').innerHTML = '';
    
    // сброс текст статуса файлов
    var fileStatus = document.getElementById('fileStatus');
    if (fileStatus) {
        fileStatus.textContent = 'No files selected';
    }
    
    // сброс режима редактирования
    var saveBtn = document.getElementById('saveBtn');
    saveBtn.textContent = 'Save';
    delete saveBtn.dataset.editingId;
    delete saveBtn.dataset.originalPhotos;
}

// функция для получения цвета иконки по категории
function getCategoryIcon(category) {
    var colors = {
        'food': 'orange',
        'walk': 'green', 
        'study': 'violet',
        'other': 'grey'
    };
    
    var color = colors[category] || 'gray';
    
    return new L.Icon({
        iconUrl: `https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
}

// функция создания маркера
function createMarker(markerId, coords, title, description, date, category, coordsText, photos) {
    var popupContent = generatePopupContent(markerId, title, description, date, category, coordsText, photos);
    
    var marker = L.marker(coords, {
        icon: getCategoryIcon(category)
    })
    .addTo(map)
    .bindPopup(popupContent, { closeButton: false }); // минус крестик
    
    markersData.push({
        id: markerId,
        marker: marker,
        title: title,
        description: description,
        date: date,
        category: category,
        coords: coordsText,
        photos: photos
    });
    
    saveMarkersToStorage();
    console.log('Marker created:', title, 'with', photos.length, 'photos');
}


// функция генерации содержимого popup
function generatePopupContent(markerId, title, description, date, category, coordsText, photos) {
    var photosHtml = '';
    
    if (photos && photos.length > 0) {
        photosHtml = `
            <div class="popup-photos">
                <div class="popup-photos-title">Photos:</div>
                <div class="popup-photos-grid">
        `;
        
        photos.forEach(function(photo) {
            photosHtml += `
                <img src="${photo.data}" 
                     alt="${photo.name}" 
                     class="popup-photo"
                     onclick="openImageModal('${photo.data}')">
            `;
        });
        
        photosHtml += `
                </div>
            </div>
        `;
    }
    
    return `
        <div class="popup-container">
            <button class="edit-btn popup-edit-btn" onclick="editMarker('${markerId}')"></button>
            <h3 class="popup-title">${title}</h3>
            <div class="popup-field description"><strong>Description:</strong> ${description || 'Not selected'}</div>
            <div class="popup-field"><strong>Date:</strong> ${date || 'Not selected'}</div>
            <div class="popup-field"><strong>Category:</strong> ${getCategoryName(category)}</div>
            <div class="popup-field"><strong>Coordinates:</strong> ${coordsText}</div>
            ${photosHtml}
        </div>
    `;
}


// функция для открытия фото в модальном окне
function openImageModal(imageSrc) {
    if (!document.getElementById('photoModal')) {
        var modal = document.createElement('div');
        modal.id = 'photoModal';
        modal.className = 'photo-modal';
        modal.innerHTML = `
            <button class="photo-modal-close">&times;</button>
            <img class="photo-modal-content">
        `;
        document.body.appendChild(modal);
        
        modal.querySelector('.photo-modal-close').addEventListener('click', function() {
            modal.style.display = 'none';
        });
        
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    var modal = document.getElementById('photoModal');
    var modalImg = modal.querySelector('.photo-modal-content');
    modalImg.src = imageSrc;
    modal.style.display = 'flex';
}



// обработчик для кнопки лупы
document.getElementById('coordSearchBtn').addEventListener('click', function() {
    document.getElementById('coordSearchModal').style.display = 'flex';
    document.getElementById('coordX').focus();
});

// для подтверждения поиска
document.getElementById('confirmCoordSearch').addEventListener('click', function() {
    searchByCoordinates();
});

// для отмены поиска
document.getElementById('cancelCoordSearch').addEventListener('click', function() {
    closeCoordModal();
});

// для Enter в полях координат
document.getElementById('coordX').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('coordY').focus();
    }
});

document.getElementById('coordY').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchByCoordinates();
    }
});

// функция закрытия модального окна координат
function closeCoordModal() {
    document.getElementById('coordSearchModal').style.display = 'none';
    document.getElementById('coordX').value = '';
    document.getElementById('coordY').value = '';
}

// функция поиска по координатам
function searchByCoordinates() {
    var coordX = document.getElementById('coordX').value.trim();
    var coordY = document.getElementById('coordY').value.trim();
    
    if (!coordX || !coordY) {
        alert('Please enter both coordinates');
        return;
    }

    var lat = parseFloat(coordX);
    var lng = parseFloat(coordY);
    
    if (isNaN(lat) || isNaN(lng)) {
        alert('Invalid coordinates. Please enter valid numbers');
        return;
    }

    if (lat < -90 || lat > 90) {
        alert('Invalid latitude. Must be between -90 and 90');
        document.getElementById('coordX').focus();
        return;
    }
    
    if (lng < -180 || lng > 180) {
        alert('Invalid longitude. Must be between -180 and 180');
        document.getElementById('coordY').focus();
        return;
    }

    // центрированин карты на координатах
    map.setView([lat, lng], 15);
    
    closeCoordModal();

    // автоматически открытие формы создания метки
    setTimeout(function() {
        document.getElementById('coords').value = lat.toFixed(6) + ', ' + lng.toFixed(6);
        document.getElementById('overlay').style.display = 'block';
        document.getElementById('placeForm').style.display = 'flex';
        document.getElementById('title').focus();
    }, 500);
}

document.getElementById('coordSearchModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeCoordModal();
    }
});


// функция для получения названия категории
function getCategoryName(categoryValue) {
    var categories = {
        'food': 'Food',
        'walk': 'Walk',
        'study': 'Study',
        'other': 'Other'
    };
    return categories[categoryValue] || categoryValue;
}

// обработчик для оверлея
document.getElementById('overlay').addEventListener('click', function() {
    closeForm();
});

// инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    updateFileCounter();
    loadMarkersFromStorage();
});

window.travelMap = {
    exportData: exportMarkersData,
    importData: importMarkersData,
    clearStorage: clearStorage,
    clearPhotos: clearAllPhotos, // новая функция
    getMarkersCount: function() { return markersData.length; },
    getStorageSize: checkStorageSize,
    getMarkersWithPhotos: function() {
        return markersData.filter(m => m.photos && m.photos.length > 0);
    }
};