import { Menu } from '@ark-ui/react/menu';

export const SelectorMenuArrow = () => {
  return (
    <Menu.Arrow asChild>
      <span
        aria-hidden="true"
        className="selector-menu-arrow"
      />
    </Menu.Arrow>
  );
};

export default SelectorMenuArrow;
