function doPost(e) {
  // Manejo de solicitudes CORS (opciones preflight)
  if (e.postData == null || e.postData.contents == null) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No data provided' }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*');
  }

  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    var ss = SpreadsheetApp.openById(sheetId);
    
    var responseData = {};

    if (action === 'register_user') {
      var sheet = ss.getSheetByName('Usuarios');
      if (!sheet) sheet = ss.insertSheet('Usuarios');
      
      // Headers si está vacía
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Nombre', 'RUT', 'Correo', 'Clave', 'Instagram', 'Chat_Link', 'Rol', 'Fecha']);
      }
      
      sheet.appendRow([
        data.payload.nombre,
        data.payload.rut,
        data.payload.correo,
        data.payload.clave,
        data.payload.instagram,
        data.payload.chatLink,
        data.payload.rol || 'promotor',
        new Date()
      ]);
      responseData = { status: 'success', message: 'Usuario registrado' };
    } 
    
    else if (action === 'get_users') {
      var sheet = ss.getSheetByName('Usuarios');
      var users = [];
      if (sheet && sheet.getLastRow() > 1) {
        var values = sheet.getDataRange().getValues();
        var headers = values[0];
        for (var i = 1; i < values.length; i++) {
          var row = values[i];
          var obj = {};
          for (var j = 0; j < headers.length; j++) {
            obj[headers[j].toLowerCase()] = row[j];
          }
          users.push(obj);
        }
      }
      responseData = { status: 'success', data: users };
    }

    else if (action === 'create_task') {
      var sheet = ss.getSheetByName('Tareas');
      if (!sheet) sheet = ss.insertSheet('Tareas');
      
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['ID_Tarea', 'Titulo', 'Material_Nuevo', 'Material_Historico', 'Horas_Duracion', 'Fecha_Creacion', 'Activa']);
      }
      
      var taskId = Utilities.getUuid();
      sheet.appendRow([
        taskId,
        data.payload.titulo,
        data.payload.materialNuevo,
        data.payload.materialHistorico,
        data.payload.horas,
        new Date(),
        true
      ]);
      responseData = { status: 'success', taskId: taskId };
    }

    else if (action === 'get_tasks') {
      var sheet = ss.getSheetByName('Tareas');
      var tasks = [];
      if (sheet && sheet.getLastRow() > 1) {
         var values = sheet.getDataRange().getValues();
         var headers = values[0];
         for (var i = 1; i < values.length; i++) {
           var obj = {};
           for (var j = 0; j < headers.length; j++) {
             obj[headers[j].toLowerCase()] = values[i][j];
           }
           tasks.push(obj);
         }
      }
      responseData = { status: 'success', data: tasks };
    }
    
    else if (action === 'submit_task') {
      var sheet = ss.getSheetByName('Submissions');
      if (!sheet) sheet = ss.insertSheet('Submissions');
      
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['ID_Tarea', 'Correo_Usuario', 'Estatus', 'Fecha']);
      }
      
      sheet.appendRow([
        data.payload.taskId,
        data.payload.correo,
        data.payload.status, // ej. "COMPLETADA"
        new Date()
      ]);
      responseData = { status: 'success' };
    }
    
    else if (action === 'log_metric') {
      var sheet = ss.getSheetByName('Metricas');
      if (!sheet) sheet = ss.insertSheet('Metricas');
      
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Correo_Referidor', 'Tipo_Accion', 'Fecha']);
      }
      
      sheet.appendRow([
        data.payload.referidor, // El promotor que trajo el link
        data.payload.tipo, // "visita", "click_tm", "click_gratis"
        new Date()
      ]);
      responseData = { status: 'success' };
    }

    else {
      responseData = { status: 'error', message: 'Action not found' };
    }

    return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*');
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*');
  }
}

// Para habilitar peticiones OPTIONS previas (CORS) de React
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
