// Imports
var UI = require('ui');
var Vector2 = require('vector2');
var ajax = require('ajax');
var Settings = require('settings');

Settings.config(
    { url: 'http://mgeek.fr/pebble_lelcloud.html' },
    function(e) {
        var card = new UI.Card({
            title: "Configuration" ,
            body: "Une fois terminée, veuillez relancer l'application LELCloud."
        });
        card.show();
    },
    function(e) {
        console.log(JSON.stringify(e.options));
        Settings.option('email', e.options.login);
        Settings.option('password', e.options.password);
    }
);

// Variables
var UserSession = {
    "ContextKey": null, // used for requests after login
    "Name": null, // who are u ?
    "DataJson": null, // building response
    "Building": [null, null], // id, position in array
    "Floor": [null, null], // id, position in array
    "Area": [null, null], // id, position in array
    "Device": [null, null, null] // id, position in array, device state
};

var LoginEmail = Settings.option('email');
var LoginPassword = Settings.option('password');

console.log(Settings.option('email'));
console.log(Settings.option('password'));

var winHome = new UI.Window({ fullscreen: true });

var lelcloud_logo = new UI.Image({
    position: new Vector2(0, 24),
    size: new Vector2(144, 69),
    image: 'images/cloud.png'
});

var lelcloud_text = new UI.Text({
    position: new Vector2(0, 99),
    size: new Vector2(144, 30),
    font: 'gothic-28',
    text: 'LELCloud',
    textAlign: 'center'
});

winHome.add(lelcloud_logo);
winHome.add(lelcloud_text);

var Menu_SelectBuilding;
var Menu_SelectFloor;
var Menu_SelectArea;
var Menu_SelectDevice;
var Menu_SetDevice;

if (!LoginEmail || !LoginPassword) {
    var card = new UI.Card({
        title: "Erreur",
        body: "Veuillez configurer vos identifiants sur l'application Pebble de votre téléphone."
    });
    card.show();
} else {

    winHome.show();

    ajax({
        url: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/Login/ClientLogin',
        method: 'POST',
        type: 'json',
        data: {
            "AppVersion": "1.9.1.0",
            "CaptchaChallenge": null,
            "CaptchaResponse": null,
            "Language": 7,
            "Persist": true,
            "Email": LoginEmail,
            "Password": LoginPassword
        }
    },
         function(data) {
             console.log(JSON.stringify(data));
             UserSession.ContextKey = data.LoginData.ContextKey;       
             UserSession.Name = data.LoginData.Name;

             ajax({
                 url: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/User/ListDevices',
                 type: 'json',
                 headers: { "X-MitsContextKey": UserSession.ContextKey }
             },
                  function(data) {
                      console.log(JSON.stringify(data));                   
                      UserSession.DataJson = data;

                      var buildings = [];
                      data.forEach(function(building, i) {
                          buildings.push({
                              title: building.Name,
                              subtitle: building.AddressLine1, //+ " - " + building.AddressLine2 + " - " + building.City,
                              id: building.ID,
                              index: i
                          });
                      });

                      Menu_SelectBuilding = new UI.Menu({
                          sections: [{
                              items: buildings
                          }]
                      });

                      Menu_SelectBuilding.show();

                      Menu_SelectBuilding.on('select', function(e) {
                          UserSession.Building = [e.item.index, e.item.id];
                          var data = UserSession.DataJson;                    

                          var floors = [];
                          data[UserSession.Building[0]].Structure.Floors.forEach(function(floor, i) {
                              floors.push({
                                  title: floor.Name,
                                  id: floor.ID,
                                  index: i
                              });
                          });

                          Menu_SelectFloor = new UI.Menu({
                              sections: [{
                                  items: floors
                              }]
                          });

                          Menu_SelectFloor.show();

                          Menu_SelectFloor.on('select', function(e) {
                              UserSession.Floor = [e.item.index, e.item.id];
                              var data = UserSession.DataJson;

                              var areas = [];
                              data[UserSession.Building[0]].Structure.Floors[UserSession.Floor[0]].Areas.forEach(function(area, i) {
                                  areas.push({
                                      title: area.Name,
                                      id: area.ID,
                                      index: i
                                  });
                              });

                              Menu_SelectArea = new UI.Menu({
                                  sections: [{
                                      items: areas
                                  }]
                              });

                              Menu_SelectArea.show();

                              Menu_SelectArea.on('select', function(e) {
                                  UserSession.Area = [e.item.index, e.item.id];
                                  var data = UserSession.DataJson;

                                  var devices = [];
                                  data[UserSession.Building[0]].Structure.Floors[UserSession.Floor[0]].Areas[UserSession.Area[0]].Devices.forEach(function(device, i) {
                                      devices.push({
                                          title: device.DeviceName,
                                          id: device.DeviceID,
                                          index: i
                                      });
                                  });

                                  Menu_SelectDevice = new UI.Menu({
                                      sections: [{
                                          items: devices
                                      }]
                                  });

                                  Menu_SelectDevice.show();

                                  Menu_SelectDevice.on('select', function(e) {
                                      UserSession.Device = [e.item.index, e.item.id];
                                      setDevice();
                                  });

                              });                        
                          });
                      });

                  },
                  function(error) {
                      console.log('Download failed: ' + error);
                  }
                 );
         },
         function(error) {
             console.log('Download failed: ' + error);
         }
        );
}
function setDevice() {
    ajax({
        url: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/Get?id=' + UserSession.Device[1] + '&buildingID=' + UserSession.Building[1],
        type: 'json',
        headers: { "X-MitsContextKey": UserSession.ContextKey }
    },
         function(data) {
             console.log(JSON.stringify(data));
             UserSession.Device[3] = data;

             var items = [];

             if (data.Offline) items.push({ internalname: "Offline", title: "Hors-connexion", subtitle: "Impossible d'établir une connexion avec l'appareil" });
             else {
                 // État
                 items.push({ internalname: "Power", internalvalue: data.Power, title: "État", subtitle: data.Power ? "Marche" : "Arrêt" });

                 // Mode               
                 var subtitle = "";
                 switch (data.OperationMode) {
                     case 1: subtitle = "Chauffage"; break;
                     case 3: subtitle = "Climatisation"; break;
                     case 7: subtitle = "Ventilation"; break;
                     case 8: subtitle = "Automatique"; break;                        
                 }
                 items.push({ internalname: "OperationMode", internalvalue: data.OperationMode, title: "Mode", subtitle: subtitle });

                 // Température
                 items.push({ internalname: "SetTemperature", internalvalue: data.SetTemperature, internalvalue_alt: data.RoomTemperature, title: "Température", subtitle: data.SetTemperature + "°C (pièce: " + data.RoomTemperature + "°C)" });

                 // Vitesse des ventilateurs -- Si 0 = Automatique
                 items.push({ internalname: "SetFanSpeed", internalvalue: data.SetFanSpeed, internalvalue_alt: data.NumberOfFanSpeeds, title: "Vitesse des ventilateurs", subtitle: data.SetFanSpeed + "/" + data.NumberOfFanSpeeds });                

                 // Actions
                 items.push({ internalname: "Update", title: "Enregistrer" });
             }

             Menu_SetDevice = new UI.Menu({
                 sections: [{
                     items: items                                               
                 }]
             });

             Menu_SetDevice.show();

             Menu_SetDevice.on('select', function(e) {
                 var i = getMenuItemIndex(Menu_SetDevice, e.item.internalname);
                 var item = Menu_SetDevice.item(0, i);
                 switch (e.item.internalname) {
                     case "Power":
                         Menu_SetDevice.item(0, i, { internalname: "Power", internalvalue: (!item.internalvalue), title: "État", subtitle: (!item.internalvalue) ? "Marche" : "Arrêt" });
                         break;
                     case "OperationMode":

                         switch (item.internalvalue) {
                             case 1: Menu_SetDevice.item(0, i, { internalname: "OperationMode", internalvalue: 3, title: "Mode", subtitle: "Climatisation" }); break;
                             case 3: Menu_SetDevice.item(0, i, { internalname: "OperationMode", internalvalue: 7, title: "Mode", subtitle: "Ventilation" }); break;
                             case 7: Menu_SetDevice.item(0, i, { internalname: "OperationMode", internalvalue: 8, title: "Mode", subtitle: "Automatique" }); break;
                             case 8: Menu_SetDevice.item(0, i, { internalname: "OperationMode", internalvalue: 1, title: "Mode", subtitle: "Chauffage" }); break;
                         }

                         /*var Menu_OperationMode = new UI.Menu({
                                 sections: [{
                                     items: [
                                         { internalvalue: 1, title: "Chauffage" },
                                         { internalvalue: 3, title: "Climatisation" },
                                         { internalvalue: 7, title: "Ventilation" },
                                         { internalvalue: 8, title: "Automatique" }
                                     ]
                                 }]
                             });

                             Menu_OperationMode.show();

                             Menu_OperationMode.on('select', function(e) {
                                 Menu_SetDevice.item(0, i, { internalname: "OperationMode", internalvalue: e.item.internalvalue, title: "Mode", subtitle: e.item.title });   
                                 Menu_OperationMode.hide();
                             });*/

                         break;
                     case "SetTemperature":                         
                         var Temperature = e.item.internalvalue + 1;
                         if (Temperature == 31) Temperature = 19;

                         Menu_SetDevice.item(0, i, { internalname: "SetTemperature", internalvalue: Temperature, internalvalue_alt: e.item.internalvalue_alt, title: "Température", subtitle: Temperature + "°C (pièce: " + e.item.internalvalue_alt + "°C)" });
                         break;

                     case "SetFanSpeed":
                         var FanSpeed = e.item.internalvalue + 1;
                         if (FanSpeed == e.item.internalvalue_alt + 1) FanSpeed = 0;

                         if (FanSpeed === 0) {
                             Menu_SetDevice.item(0, i, { internalname: "SetFanSpeed", internalvalue: FanSpeed, internalvalue_alt: e.item.internalvalue_alt, title: "Vitesse des ventilateurs", subtitle: "Automatique" });
                         } else {
                             Menu_SetDevice.item(0, i, { internalname: "SetFanSpeed", internalvalue: FanSpeed, internalvalue_alt: e.item.internalvalue_alt, title: "Vitesse des ventilateurs", subtitle: FanSpeed + "/" + e.item.internalvalue_alt });    
                         }

                         break;

                     case "Update":
                         UserSession.Device[3].HasPendingCommand = true;

                         if (UserSession.Device[3].Power != Menu_SetDevice.item(0, getMenuItemIndex(Menu_SetDevice, "Power")).internalvalue) {
                             UserSession.Device[3].Power = Menu_SetDevice.item(0, getMenuItemIndex(Menu_SetDevice, "Power")).internalvalue;
                             UserSession.Device[3].EffectiveFlags += 1;
                         }

                         if (UserSession.Device[3].OperationMode != Menu_SetDevice.item(0, getMenuItemIndex(Menu_SetDevice, "OperationMode")).internalvalue) {
                             UserSession.Device[3].OperationMode = Menu_SetDevice.item(0, getMenuItemIndex(Menu_SetDevice, "OperationMode")).internalvalue;
                             UserSession.Device[3].EffectiveFlags += 2;
                         }

                         if (UserSession.Device[3].SetTemperature != Menu_SetDevice.item(0, getMenuItemIndex(Menu_SetDevice, "SetTemperature")).internalvalue) {
                             UserSession.Device[3].SetTemperature = Menu_SetDevice.item(0, getMenuItemIndex(Menu_SetDevice, "SetTemperature")).internalvalue;
                             UserSession.Device[3].EffectiveFlags += 4;
                         }

                         if (UserSession.Device[3].SetFanSpeed != Menu_SetDevice.item(0, getMenuItemIndex(Menu_SetDevice, "SetFanSpeed")).internalvalue) {
                             UserSession.Device[3].SetFanSpeed = Menu_SetDevice.item(0, getMenuItemIndex(Menu_SetDevice, "SetFanSpeed")).internalvalue;
                             UserSession.Device[3].EffectiveFlags += 8;
                         }

                         ajax({
                             url: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/SetAta',
                             method: 'POST',
                             type: 'json',
                             headers: { "X-MitsContextKey": UserSession.ContextKey },
                             data: UserSession.Device[3]
                         },
                              function (data) {
                                  var d = new Date(data.NextCommunication);
                                  var datestring = d.getHours() + ":" + d.getMinutes();

                                  var card = new UI.Card({
                                      body: "Vos modifications prendront effet approximativement à " + datestring
                                  });
                                  card.show();

                                  Menu_SetDevice.hide();
                              }, 
                              function (error) {
                                  console.log('Download failed: ' + error);
                              });

                         break;                        
                 }
             });

         },
         function(error) {
             console.log('Download failed: ' + error);
         }
        );
}

function getMenuItemIndex(menu, internalname) {
    var ret = null;
    menu.state.sections[0].items.forEach(function (item, i) {
        console.log(item.internalname);
        if (item.internalname == internalname) ret = i;
    });
    return ret;
}