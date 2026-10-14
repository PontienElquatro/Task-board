import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  standalone: true, imports: [RouterLink],
  templateUrl: './public-pages.component.html', styleUrl: './public-pages.component.css'
})
export class PublicPagesComponent {
  readonly page = inject(ActivatedRoute).snapshot.data['publicPage'] as 'home' | 'features' | 'about';
  readonly features = [
    { number: '01', title: 'Un tableau pour agir', text: 'À faire, En cours, Terminé. Donnez une place à chaque action, ajoutez ses sous-tâches et choisissez sa priorité.' },
    { number: '02', title: 'Des projets pour garder le cap', text: 'Regroupez vos tâches par projet et retrouvez rapidement ce qui contribue à votre objectif.' },
    { number: '03', title: 'Un calendrier pour anticiper', text: 'Planifiez le début et la fin de vos tâches. Consultez vos échéances en vue mois, semaine ou agenda.' },
    { number: '04', title: 'Un espace pour votre équipe', text: 'Partagez des projets, attribuez des tâches et collaborez selon les droits de chaque membre.' },
    { number: '05', title: 'Vos copies, à portée de main', text: 'Travaillez en local ou connectez-vous pour la sauvegarde cloud. Exportez une copie et retrouvez les outils de récupération.' },
    { number: '06', title: 'Votre rythme, votre affichage', text: 'Filtres, recherche, thème sombre et préférences de cartes : adaptez votre espace à votre façon de travailler.' }
  ];
}
