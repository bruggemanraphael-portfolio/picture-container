# Picture Container

Web Component natif JavaScript permettant d'afficher une image statique dans un conteneur circulaire avec :

- chargement depuis une URL ;
- sélection d'une image locale ;
- glisser-déposer ;
- déplacement de l'image ;
- zoom à la molette ;
- zoom tactile par pincement ;
- positionnement initial via `x`, `y` et `zoom` ;
- indication d'état (`none`, `active`, `inactive`, `pending`).

Le composant ne dépend pas d'Aurelia ni d'Angular. Il est utilisable directement dans Angular 14 et versions ultérieures comme Web Component.

## Fichiers nécessaires

Copiez ces deux fichiers dans le dossier `src/assets/picture-container/` de votre application Angular :

```text
src/assets/picture-container/picture.js
src/assets/picture-container/camera-icon.svg
```

Le fichier SVG doit rester dans le même dossier que `picture.js`, car l'icône est chargée avec `import.meta.url`.

## Configuration Angular

### 1. Déclarer les assets

Dans `angular.json`, ajoutez le dossier du composant dans la section `assets` du projet :

```json
{
  "glob": "**/*",
  "input": "src/assets/picture-container",
  "output": "assets/picture-container"
}
```

Exemple de configuration complète :

```json
"assets": [
  "src/favicon.ico",
  "src/assets",
  {
    "glob": "**/*",
    "input": "src/assets/picture-container",
    "output": "assets/picture-container"
  }
]
```

### 2. Charger le Web Component

Dans `src/index.html`, ajoutez le module une seule fois, avant la fermeture de `body` :

```html
<script type="module" src="assets/picture-container/picture.js"></script>
```

Le fichier `picture.js` appelle automatiquement :

```js
customElements.define('picture-container', PictureContainer);
```

Cette méthode évite les erreurs TypeScript de type `TS7016` liées à l'import direct d'un fichier JavaScript sans déclaration de types. Si votre projet autorise déjà les imports JavaScript (`allowJs`), vous pouvez aussi importer le fichier dans `src/main.ts` :

```ts
import './assets/picture-container/picture.js';
```

### 3. Autoriser les éléments personnalisés

Dans `src/app/app.module.ts`, ajoutez `CUSTOM_ELEMENTS_SCHEMA` :

```ts
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule],
  providers: [],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule {}
```

Sans ce schéma, Angular signale que `picture-container` est un élément inconnu.

## Utilisation simple

Dans `app.component.html` :

```html
<picture-container
  initial="RB"
  camera-enabled
  activity-state="active"
  image-url="assets/images/profile.jpg"
  x="0"
  y="0"
  zoom="0.5">
</picture-container>
```

L'image doit être un format statique, par exemple `jpg`, `jpeg`, `png` ou `webp`. Les URL se terminant par `.gif` ou `.apng` sont refusées par le composant.

## Utilisation avec des valeurs Angular

Dans `app.component.ts` :

```ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent {
  imageUrl = 'assets/images/profile.jpg';
  initial = 'RB';
  cameraEnabled = true;
  activityState: 'none' | 'active' | 'inactive' | 'pending' = 'active';
  imageX = 0;
  imageY = 0;
  imageZoom = 0.5;

  onPicInfoChange(event: CustomEvent): void {
    const info = event.detail as { left: number; top: number; zoom: number };
    this.imageX = info.left;
    this.imageY = info.top;
    this.imageZoom = info.zoom;
  }

  onPictureClick(): void {
    console.log('Image cliquée');
  }
}
```

Dans `app.component.html` :

```html
<picture-container
  [attr.initial]="initial"
  [attr.camera-enabled]="cameraEnabled ? '' : null"
  [attr.activity-state]="activityState"
  [attr.image-url]="imageUrl"
  [attr.x]="imageX"
  [attr.y]="imageY"
  [attr.zoom]="imageZoom"
  (picinfo-change)="onPicInfoChange($event)"
  (pic-click)="onPictureClick()">
</picture-container>
```

Les attributs `x`, `y` et `zoom` sont des chaînes HTML converties en nombres par le composant. Utilisez `[attr.nom]` pour éviter les ambiguïtés des bindings Angular sur les éléments personnalisés.

## API des attributs

| Attribut | Valeur | Description |
| --- | --- | --- |
| `initial` | chaîne | Texte affiché dans le placeholder. |
| `camera-enabled` | attribut booléen | Affiche le bouton de sélection d'image. |
| `activity-state` | `none`, `active`, `inactive`, `pending` | Couleur de la bordure. |
| `placeholder` | `true` ou `false` | Affiche ou masque le placeholder. |
| `image-url` | URL | Image statique à afficher. |
| `x` | nombre | Décalage horizontal en pixels. |
| `y` | nombre | Décalage vertical en pixels. |
| `zoom` | nombre de `0.1` à `3` | Niveau de zoom initial. |

Le zoom par défaut est `0.5`. Les limites sont `0.1` et `3`.

## API JavaScript

Le composant expose également les propriétés suivantes :

```ts
interface PictureInfo {
  left: number;
  top: number;
  zoom: number;
}

interface PictureContainerElement extends HTMLElement {
  initial: string;
  isCameraEnabled: boolean;
  activityState: 'none' | 'active' | 'inactive' | 'pending';
  src: string;
  placeholder: boolean;
  picInfo: PictureInfo;
  onUpdate: ((info: PictureInfo) => void) | null;
}
```

Pour modifier `picInfo` depuis Angular :

```ts
import { Component, ElementRef, ViewChild } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent {
  @ViewChild('picture', { static: true })
  picture!: ElementRef<HTMLElement & { picInfo: { left: number; top: number; zoom: number } }>;

  setPosition(): void {
    this.picture.nativeElement.picInfo = {
      left: 10,
      top: -5,
      zoom: 0.8
    };
  }
}
```

Template correspondante :

```html
<picture-container #picture></picture-container>
<button type="button" (click)="setPosition()">Positionner l'image</button>
```

## Événements

| Événement | `event.detail` | Description |
| --- | --- | --- |
| `liste-mise-a-jour` | `{ data: PictureInfo }` | Émis à l'initialisation. |
| `picinfo-change` | `PictureInfo` | Émis après un déplacement ou un zoom. |
| `placeholder-change` | `boolean` | Émis lorsque le placeholder change. |
| `src-change` | `string` | Émis lorsque l'URL ou le fichier image change. |
| `pic-click` | aucun | Émis lorsque l'image est cliquée. |

Exemple pour récupérer l'URL chargée :

```html
<picture-container (src-change)="onSourceChange($event)"></picture-container>
```

```ts
onSourceChange(event: CustomEvent<string>): void {
  console.log('Nouvelle source :', event.detail);
}
```

## Sélection locale et mobile

Le bouton caméra ouvre le sélecteur de fichiers du navigateur. Sur mobile, l'utilisateur peut sélectionner une image depuis la galerie ou prendre une photo selon les options du navigateur.

Pour tester depuis un GSM pendant le développement :

1. démarrez un serveur HTTP dans le dossier du projet ;
2. connectez le GSM et le PC au même réseau Wi-Fi ;
3. ouvrez l'adresse IP du PC depuis le GSM, par exemple `http://192.168.1.29:5500/picture.html`.

Pour une application Angular, utilisez normalement :

```bash
ng serve --host 0.0.0.0
```

Puis ouvrez depuis le GSM :

```text
http://ADRESSE_IP_DU_PC:4200
```

Le pare-feu Windows et l'isolation des clients Wi-Fi peuvent empêcher l'accès depuis le GSM.

## Compatibilité et précautions

- Le composant doit être chargé via `http://` ou `https://`, pas directement avec `file://`.
- Le fichier `camera-icon.svg` doit être déployé à côté de `picture.js`.
- Les URL d'images distantes doivent être accessibles depuis le navigateur et respecter les règles CORS du serveur distant.
- Les images animées `.gif` et `.apng` ne sont pas acceptées.
- Le geste à un doigt déplace l'image ; le geste à deux doigts modifie le zoom.
