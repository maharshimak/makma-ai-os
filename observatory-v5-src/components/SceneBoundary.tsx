"use client";

import {Component,type ReactNode} from "react";

export class SceneBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};

  static getDerivedStateFromError(){
    return {failed:true};
  }

  componentDidCatch(error:unknown){
    console.warn("3D scene disabled; static fallback enabled.",error);
  }

  render(){
    if(this.state.failed){
      return <div className="world-canvas world-canvas-fallback" aria-hidden="true"/>;
    }
    return this.props.children;
  }
}
