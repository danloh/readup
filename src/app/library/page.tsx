'use client';

import LibraryPage from './components/LibraryPage';
import NavBar from '../NavBar';

export default function Library() {
  return (<NavBar tab={'library'} >{LibraryPage()}</NavBar>);
}
